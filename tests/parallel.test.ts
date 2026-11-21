import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { forRows } from 'defuss-dataview/compute';
import { openDirectory } from '../src/server.js';
import type { Database } from '../src/index.js';

type Item = { id: number; group: number; n: number; price: number };
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const run of cleanup.splice(0).reverse()) await run();
});
async function seeded(rows = 3000) {
  const path = await mkdtemp(join(tmpdir(), 'defuss-db-parallel-'));
  cleanup.push(() => rm(path, { recursive: true, force: true }));
  const db = await openDirectory(path, { autoCompact: false });
  const items = db.collection<Item>('items');
  await items.createIndex({ name: 'byGroup', fields: ['group'] });
  await items.insertMany(
    Array.from({ length: rows }, (_, id) => ({ id, group: id % 5, n: id, price: id * 0.25 })),
  );
  await db.close();
  return path;
}
/** The first eligible aggregate starts the workers and runs in this thread; wait until they are ready. */
async function started(db: Database) {
  await db.collection<Item>('items').count({}, { cache: false });
  while ((await db.stats()).parallel?.state === 'starting')
    await new Promise((resolve) => setTimeout(resolve, 5));
  return (await db.stats()).parallel;
}
async function open(path: string, workers = 3, minRows = 100) {
  const db = await openDirectory(path, { parallel: { workers, minRows } });
  cleanup.push(() => db.close());
  expect(await started(db)).toMatchObject({ state: 'ready', starts: 1 });
  return db;
}
const q = forRows<Item>();
const grouped = (numberMode?: 'exact') => ({
  groupBy: { group: q.field('group') },
  measures: { count: q.count(), total: q.sum(q.field('price')), top: q.max(q.field('n')) },
  orderBy: [{ field: 'group', direction: 'asc' as const }],
  ...(numberMode && { numberMode }),
});
async function single(path: string, run: (db: Database) => Promise<unknown>) {
  const db = await openDirectory(path);
  try {
    return await run(db);
  } finally {
    await db.close();
  }
}

describe('parallel aggregates', () => {
  it('answer mergeable aggregates and counts from worker partials, equal to one thread', async () => {
    const path = await seeded();
    const db = await open(path);
    const items = db.collection<Item>('items');
    const merged = await items.aggregate(grouped('exact'), undefined, { cache: false });
    expect(merged.summary.strategy).toBe('merge');
    expect(merged.summary.scannedRows).toBe(3000);
    const expected = await single(path, (one) =>
      one.collection<Item>('items').aggregate(grouped('exact'), undefined, { cache: false }),
    );
    expect(merged.rows).toEqual((expected as typeof merged).rows);
    expect(merged.rows[0]).toEqual({ group: 0, count: 600, total: 224_625, top: 2995 });
    // A filter on a field without an index still scans the whole collection.
    expect(await items.count({ filters: [{ field: 'n', op: 'lt', value: 1000 }] })).toBe(1000);
    const snapshot = await db.snapshot();
    try {
      const pinned = await snapshot
        .collection<Item>('items')
        .aggregate(grouped('exact'), undefined, { cache: false });
      expect(pinned.summary.strategy).toBe('merge');
    } finally {
      await snapshot.close();
    }
    expect((await db.stats()).parallel).toMatchObject({ state: 'ready', workers: 3, fallbacks: 0 });
    expect((await db.stats()).parallel!.queries).toBeGreaterThanOrEqual(3);
  });

  it('merge calendar buckets, distinct counts and percentiles from worker partials, equal to one thread', async () => {
    const path = await seeded();
    const db = await open(path);
    // n hours after 2024-03-29T00:00Z: 3,000 hours cross the Berlin DST change of 2024-03-31.
    const at = q.add(q.literal(Date.UTC(2024, 2, 29)), q.mul(q.field('n'), q.literal(3_600_000)));
    const descriptor = {
      groupBy: {
        month: q.dateTrunc(at, 'month', { timeZone: 'Europe/Berlin' }),
        weekday: q.datePart(at, 'weekday', { timeZone: 'Europe/Berlin' }),
      },
      measures: {
        days: q.countDistinct(q.dateTrunc(at, 'day', { timeZone: 'Europe/Berlin' })),
        groups: q.distinct(q.field('group')),
        median: q.median(q.field('price')),
        p90: q.percentile(q.field('n'), 0.9),
      },
      orderBy: [
        { field: 'month', direction: 'asc' as const },
        { field: 'weekday', direction: 'asc' as const },
      ],
    };
    const merged = await db
      .collection<Item>('items')
      .aggregate(descriptor, undefined, { cache: false });
    expect(merged.summary.strategy).toBe('merge');
    const expected = await single(path, (one) =>
      one.collection<Item>('items').aggregate(descriptor, { limit: 100 }, { cache: false }),
    );
    expect(merged.rows).toEqual((expected as typeof merged).rows);
    // The first Berlin month starts at local midnight (UTC+1) and holds Friday the 29th to Sunday the 31st.
    expect(merged.rows[0]).toMatchObject({
      month: new Date(Date.UTC(2024, 1, 29, 23)),
      weekday: 5,
      days: 1,
      groups: [0, 1, 2, 3, 4],
    });
    expect(merged.rows.reduce((sum, row) => sum + row.days, 0)).toBe(126);
  });

  it('keep other aggregates in one thread', async () => {
    const path = await seeded();
    const db = await open(path);
    const items = db.collection<Item>('items');
    // Compensated sums depend on the order of the additions.
    const compensated = await items.aggregate(grouped(), undefined, { cache: false });
    expect(compensated.summary.strategy).not.toBe('merge');
    // An equality index narrows the scan.
    const indexed = await items.aggregate(
      { ...grouped('exact'), filters: [{ field: 'group', op: 'eq', value: 2 }] },
      undefined,
      { cache: false },
    );
    expect(indexed.summary.strategy).not.toBe('merge');
    expect(indexed.rows).toEqual([{ group: 2, count: 600, total: 224_925, top: 2997 }]);
    // Staged writes are invisible to the workers' handles.
    await db.transaction(async (tx) => {
      await tx.collection<Item>('items').put({ id: 5000, group: 0, n: 5000, price: 1 });
      const staged = await tx
        .collection<Item>('items')
        .aggregate(grouped('exact'), undefined, { cache: false });
      expect(staged.summary.strategy).not.toBe('merge');
      expect(staged.rows[0]!.count).toBe(601);
    });
    const small = await openDirectory(path, { parallel: { workers: 2, minRows: 1_000_000 } });
    cleanup.push(() => small.close());
    const below = await small
      .collection<Item>('items')
      .aggregate(grouped('exact'), undefined, { cache: false });
    expect(below.summary.strategy).not.toBe('merge');
    // Below minRows the workers never start.
    expect((await small.stats()).parallel).toMatchObject({ state: 'idle', starts: 0 });
  });

  it('are on by default for directory stores, start on the first eligible aggregate, and turn off with false', async () => {
    const path = await seeded();
    const db = await openDirectory(path);
    cleanup.push(() => db.close());
    expect((await db.stats()).parallel).toMatchObject({ state: 'idle', starts: 0, minRows: 1000 });
    // The first aggregate does not wait for the workers it starts.
    const first = await db
      .collection<Item>('items')
      .aggregate(grouped('exact'), undefined, { cache: false });
    expect(first.summary.strategy).not.toBe('merge');
    expect(await started(db)).toMatchObject({ state: 'ready', starts: 1 });
    const merged = await db
      .collection<Item>('items')
      .aggregate(grouped('exact'), undefined, { cache: false });
    expect(merged.summary.strategy).toBe('merge');
    expect(merged.rows).toEqual(first.rows);
    const off = await openDirectory(path, { parallel: false });
    cleanup.push(() => off.close());
    expect((await off.stats()).parallel).toBeUndefined();
  });

  it('runs a query again in one thread when a worker fails, keeping its error', async () => {
    const db = await open(await seeded());
    // Each part exceeds the group budget in its worker; the one-thread run reports the same limit.
    await expect(
      db
        .collection<Item>('items')
        .aggregate(grouped('exact'), undefined, { cache: false, maxGroups: 1 }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect((await db.stats()).parallel).toMatchObject({ fallbacks: 1 });
  });

  it('rejects a cancelled aggregate and invalid settings', async () => {
    const path = await seeded();
    const db = await open(path);
    const abort = new AbortController();
    abort.abort(new Error('stop'));
    await expect(
      db
        .collection<Item>('items')
        .aggregate(grouped('exact'), undefined, { cache: false, signal: abort.signal }),
    ).rejects.toThrow('stop');
    await expect(openDirectory(path, { parallel: { workers: 0 } })).rejects.toThrow(RangeError);
    await expect(openDirectory(path, { parallel: { minRows: -1 } })).rejects.toThrow(RangeError);
  });
});
