import { afterEach, describe, expect, it } from 'vitest';
import { openMemory } from '../src/index.js';
import type { Database, Document } from '../src/index.js';

/** DataView's grouping expressions through defuss-db, against a direct computation over the same documents. */
interface Order extends Document {
  id: number;
  customer: string;
  country: string | null;
  status: string;
  tags?: string[];
  at: Date;
  amount: number;
  big?: bigint;
}

const opened: Database[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) await db.close();
});

const COUNTRIES = ['DE', 'de', 'FR', 'AT', null];
const STATUS = ['paid', 'open', 'shipped'];
const TAGS = [['a'], ['a', 'b'], [], ['b', 'b', 'c'], undefined];
const orders: Order[] = Array.from({ length: 240 }, (_, i) => ({
  id: i + 1,
  customer: `c${i % 17}`,
  country: COUNTRIES[i % 5]!,
  status: STATUS[i % 3]!,
  ...(TAGS[i % 5] ? { tags: TAGS[i % 5] } : {}),
  at: new Date(Date.UTC(2025, i % 12, 1 + (i % 28), i % 24, 30)),
  amount: (i % 9) * 10.5,
  big: BigInt(i),
}));

async function collection(parallel = false) {
  const db = await openMemory({ parallel } as never);
  opened.push(db);
  const c = db.collection<Order>('orders');
  await c.insertMany(orders);
  return c;
}

/** groups the documents by a key function (several keys = several groups) */
function direct<K>(key: (o: Order) => K[], measure: (rows: Order[]) => unknown) {
  const groups = new Map<string, { key: K; rows: Order[] }>();
  for (const o of orders)
    for (const k of key(o)) {
      const id = JSON.stringify(k instanceof Date ? k.getTime() : k);
      if (!groups.has(id)) groups.set(id, { key: k, rows: [] });
      groups.get(id)!.rows.push(o);
    }
  return [...groups.values()].map((g) => ({ key: g.key, value: measure(g.rows) }));
}
const byKey = (rows: { key: unknown; value: unknown }[]) =>
  new Map(
    rows.map((r) => [JSON.stringify(r.key instanceof Date ? r.key.getTime() : r.key), r.value]),
  );

describe('grouping expressions', () => {
  it('groups by a text value case-insensitively and counts its distinct values', async () => {
    const c = await collection();
    const q = c.q;
    const r = await c.aggregate({
      groupBy: { country: q.lower(q.field('country')) },
      measures: {
        orders: q.count(),
        customers: q.countDistinct(q.field('customer')),
        statuses: q.distinct(q.field('status')),
        mean: q.avg(q.field('amount')),
        first: q.min(q.field('customer')),
      },
    });
    const want = direct(
      (o) => [o.country?.toLowerCase() ?? null],
      (rows) => ({
        orders: rows.length,
        customers: new Set(rows.map((o) => o.customer)).size,
        statuses: [...new Set(rows.map((o) => o.status))],
        mean: rows.reduce((s, o) => s + o.amount, 0) / rows.length,
        first: rows.map((o) => o.customer).sort()[0],
      }),
    );
    expect(r.rows.length).toBe(4); // de, fr, at, null
    const got = byKey(r.rows.map(({ country, ...value }) => ({ key: country, value })));
    for (const w of want) {
      const g = got.get(JSON.stringify(w.key)) as Record<string, unknown>;
      // distinct() keeps first-encounter order, which follows the storage keys; compare the sets.
      const statuses = [...(g.statuses as string[])].sort();
      expect({ ...g, statuses, mean: Math.round((g.mean as number) * 1e9) }).toEqual({
        ...(w.value as object),
        statuses: [...(w.value as { statuses: string[] }).statuses].sort(),
        mean: Math.round((w.value as { mean: number }).mean * 1e9),
      });
    }
  });

  it('cuts Dates to calendar units in UTC (weeks from Monday)', async () => {
    const c = await collection();
    const q = c.q;
    for (const [unit, cut] of [
      ['month', (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)],
      [
        'quarter',
        (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (d.getUTCMonth() % 3), 1),
      ],
      [
        'week',
        (d: Date) =>
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
          ((d.getUTCDay() + 6) % 7) * 86_400_000,
      ],
      ['hour', (d: Date) => Math.floor(d.getTime() / 3_600_000) * 3_600_000],
    ] as const) {
      const r = await c.aggregate({
        groupBy: { at: q.dateTrunc(q.field('at'), unit) },
        measures: { n: q.count(), sum: q.sum(q.field('amount')), big: q.sumBigInt(q.field('big')) },
        orderBy: [{ field: 'at', direction: 'asc' }],
      });
      const want = direct(
        (o) => [cut(o.at)],
        (rows) => ({
          n: rows.length,
          sum: rows.reduce((s, o) => s + o.amount, 0),
          big: rows.reduce((s, o) => s + o.big!, 0n),
        }),
      ).sort((a, b) => a.key - b.key);
      expect(r.rows.map((x) => (x.at as Date).getTime())).toEqual(want.map((w) => w.key));
      expect(r.rows.map((x) => [x.n, Math.round(x.sum! * 100), x.big])).toEqual(
        want.map((w) => {
          const v = w.value as { n: number; sum: number; big: bigint };
          return [v.n, Math.round(v.sum * 100), v.big];
        }),
      );
      if (unit === 'week') for (const x of r.rows) expect((x.at as Date).getUTCDay()).toBe(1);
    }
  });

  it('each() makes one group per distinct array element, as $unwind', async () => {
    const c = await collection();
    const q = c.q;
    const r = await c.aggregate({
      groupBy: { tag: q.each(q.field('tags')), status: q.field('status') },
      measures: { n: q.count(), max: q.max(q.field('amount')) },
    });
    const want = direct(
      (o) =>
        o.tags === undefined
          ? [[undefined, o.status]]
          : [...new Set(o.tags)].map((t) => [t, o.status]),
      (rows) => ({ n: rows.length, max: Math.max(...rows.map((o) => o.amount)) }),
    );
    const got = byKey(
      r.rows.map(({ tag, status, ...value }) => ({ key: [tag ?? null, status], value })),
    );
    expect(got.size).toBe(want.length);
    for (const w of want)
      expect(got.get(JSON.stringify((w.key as unknown[]).map((x) => x ?? null)))).toEqual(w.value);
    // an empty array is in no group
    const total = r.rows.reduce((s, x) => s + x.n, 0);
    expect(total).toBe(want.reduce((s, w) => s + (w.value as { n: number }).n, 0));
  });

  it('measure filters, having, order and paging act on the folded groups', async () => {
    const c = await collection();
    const q = c.q;
    const paid = q.eq(q.field('status'), q.literal('paid'));
    const descriptor = {
      filters: [{ field: 'amount', op: 'gt' as const, value: 0 }],
      groupBy: { customer: q.upper(q.field('customer')) },
      measures: {
        n: q.count(),
        paidCountries: q.countDistinct(q.field('country'), { where: paid }),
        paidAvg: q.avg(q.field('amount'), { where: paid }),
      },
      having: [{ field: 'n', op: 'gte' as const, value: 12 }],
      orderBy: [
        { field: 'n', direction: 'desc' as const },
        { field: 'customer', direction: 'asc' as const },
      ],
    };
    const all = await c.aggregate(descriptor);
    const kept = orders.filter((o) => o.amount > 0);
    const want = direct(
      (o) => (o.amount > 0 ? [o.customer.toUpperCase()] : []),
      (rows) => {
        const p = rows.filter((o) => o.status === 'paid');
        return {
          n: rows.length,
          paidCountries: new Set(p.map((o) => o.country).filter((x) => x !== null)).size,
          paidAvg: p.length ? p.reduce((s, o) => s + o.amount, 0) / p.length : null,
        };
      },
    )
      .filter((w) => (w.value as { n: number }).n >= 12)
      .sort(
        (a, b) =>
          (b.value as { n: number }).n - (a.value as { n: number }).n || (a.key < b.key ? -1 : 1),
      );
    expect(kept.length).toBeGreaterThan(0);
    expect(all.rows.map((r) => r.customer)).toEqual(want.map((w) => w.key));
    for (const [i, w] of want.entries()) {
      const v = w.value as { n: number; paidCountries: number; paidAvg: number | null };
      expect(all.rows[i]!.n).toBe(v.n);
      expect(all.rows[i]!.paidCountries).toBe(v.paidCountries);
      expect(all.rows[i]!.paidAvg === null ? null : Math.round(all.rows[i]!.paidAvg! * 1e6)).toBe(
        v.paidAvg === null ? null : Math.round(v.paidAvg * 1e6),
      );
    }
    const page = await c.aggregate(descriptor, { offset: 2, limit: 3 });
    expect(page.rows).toEqual(all.rows.slice(2, 5));
    expect(page.summary.totalResultRows).toBe(all.rows.length);
    expect(page.summary.hasMore).toBe(all.rows.length > 5);
  });

  it('a scalar aggregate answers one row, also over no documents', async () => {
    const c = await collection();
    const q = c.q;
    const none = await c.aggregate({
      filters: [{ field: 'amount', op: 'lt', value: -1 }],
      measures: {
        n: q.count(),
        d: q.countDistinct(q.field('customer')),
        v: q.distinct(q.field('customer')),
      },
    });
    expect(none.rows).toEqual([{ n: 0, d: 0, v: [] }]);
    const some = await c.aggregate({ measures: { v: q.distinct(q.field('customer')) } });
    expect([...some.rows[0]!.v].sort()).toEqual(
      Array.from({ length: 17 }, (_, i) => `c${i}`).sort(),
    );
  });

  it('a prepared plan evaluates, streams and explains itself', async () => {
    const c = await collection(true);
    const q = c.q;
    const plan = c.prepareAggregate({
      groupBy: { country: q.lower(q.field('country')) },
      measures: { n: q.count() },
    });
    const r = await plan.evaluate();
    expect(r.rows.reduce((s, x) => s + x.n, 0)).toBe(orders.length);
    expect(plan.explain().operators).toContain('group');
    const events = [];
    for await (const e of plan.stream()) events.push(e.type);
    expect(events).toEqual(['batch', 'complete']);
  });

  it('uses text keys in filters too, and refuses each() outside a whole group key', async () => {
    const c = await collection();
    const q = c.q;
    const german = await c.aggregate({
      where: q.eq(q.lower(q.field('country')), q.literal('de')),
      measures: { n: q.count() },
    });
    expect(german.rows).toEqual([
      { n: orders.filter((o) => o.country?.toLowerCase() === 'de').length },
    ]);
    await expect(async () =>
      c.aggregate({
        where: q.eq(q.each(q.field('tags')), q.literal('a')),
        measures: { n: q.count() },
      }),
    ).rejects.toThrow(/each\(\) must be a whole groupBy key/);
    await expect(async () =>
      c.aggregate({
        groupBy: { k: q.countDistinct(q.field('country')) as never },
        measures: { n: q.count() },
      }),
    ).rejects.toThrow(TypeError);
    await expect(async () =>
      c.aggregate({ measures: { n: q.lower(q.field('country')) as never } }),
    ).rejects.toThrow(/must be a measure/);
    await expect(async () =>
      c.aggregate({
        groupBy: { k: q.dateTrunc(q.field('at'), 'decade' as never) },
        measures: { n: q.count() },
      }),
    ).rejects.toThrow(TypeError);
  });
});
