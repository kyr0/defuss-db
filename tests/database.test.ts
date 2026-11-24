import { afterEach, describe, expect, it } from 'vitest';
import { openMemory, openDatabase, createMemoryBackend, forRows } from '../src/index.js';
import type {
  Database,
  DatabaseTransaction,
  Document,
  FindRequest,
  TransactionCollection,
} from '../src/index.js';
import { openDbsonl } from 'defuss-dbsonl';
import { createArraySource } from 'defuss-dataview/stream';

const opened: Database[] = [];
async function memory(options: Parameters<typeof openMemory>[0] = {}) {
  const db = await openMemory(options);
  opened.push(db);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.close();
});
interface User extends Document {
  name: string;
  city: string;
  score: number;
  age?: number;
  date?: Date;
  bytes?: Uint8Array;
  nested?: { yes: boolean };
  n?: bigint;
}
const fixture: User[] = [
  {
    id: 'a',
    name: 'Alice',
    city: 'Munich',
    score: 10,
    age: 30,
    date: new Date(1),
    nested: { yes: true },
    n: 10n,
  },
  {
    id: 'b',
    name: 'Bob',
    city: 'Berlin',
    score: 25,
    age: 20,
    date: new Date(2),
    nested: { yes: false },
    n: 20n,
  },
  {
    id: 'c',
    name: 'Carol',
    city: 'Munich',
    score: 15,
    date: new Date(1),
    nested: { yes: true },
    n: 30n,
  },
  { id: 'd', name: 'Dan', city: 'Berlin', score: 0, age: 40, date: new Date(3), n: 40n },
];
async function seeded() {
  const db = await memory();
  const c = db.collection<User>('users');
  await c.insertMany(fixture);
  return { db, c };
}

it('supports CRUD, generated IDs, typed IDs and collection isolation', async () => {
  const db = await memory(),
    a = db.collection<{ id: string | number | bigint; x: number }>('A'),
    b = db.collection('B');
  expect(await a.insert({ id: 1, x: 1 })).toBe(1);
  await a.insert({ id: 1n, x: 2 });
  await a.insert({ id: '1', x: 3 });
  await a.insert({ id: '', x: 4 });
  expect((await a.get(1))?.x).toBe(1);
  expect((await a.get(1n))?.x).toBe(2);
  expect((await a.get('1'))?.x).toBe(3);
  const generated = await a.insert({ x: 5 });
  expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  expect(await b.get(1)).toBeUndefined();
  expect(await b.has(1)).toBe(false);
  await a.put({ id: 1, x: 7 });
  expect(await a.update(1, { x: 8 })).toBe(true);
  expect(await a.update(9, { x: 8 })).toBe(false);
  expect(await a.delete(1)).toBe(true);
  expect(await a.delete(1)).toBe(false);
  expect(await db.collections()).toEqual(['A']);
  expect((await db.verify()).documents).toBe(4);
});
it('accepts concurrent first writes to a new collection and lists, verifies and exports it', async () => {
  const db = await openMemory();
  try {
    const fresh = db.collection<{ id: number }>('fresh');
    await Promise.all([1, 2, 3, 4].map((id) => fresh.put({ id })));
    await Promise.all([
      db.ensureCollection('made'),
      db.ensureCollection('made'),
      db.collection('made').put({ id: 1 }),
    ]);
    expect(await fresh.count()).toBe(4);
    expect(await db.collections()).toEqual(['fresh', 'made']);
    expect(await db.verify()).toMatchObject({ collections: 2, documents: 5 });
    const copy = await openMemory();
    try {
      await copy.import(await db.export());
      expect(await copy.collections()).toEqual(['fresh', 'made']);
      expect(await copy.collection('fresh').count()).toBe(4);
      await copy.verify();
    } finally {
      await copy.close();
    }
  } finally {
    await db.close();
  }
});
it('never commits part of a failed write started after the transaction callback returned', async () => {
  const db = await openMemory();
  try {
    const c = db.collection<{ id: string | number }>('c');
    await c.insert({ id: 1 });
    // Each depth starts the un-awaited insertMany a different number of microtasks after the callback returns.
    for (let depth = 0; depth <= 6; depth++) {
      let late: string | undefined;
      const outcome = await db
        .transaction(async (tx) => {
          const t = tx.collection<{ id: string | number }>('c');
          await t.put({ id: 'audit-' + depth });
          [[{ id: 'partial-' + depth }, { id: 1 }]].forEach(async (rows) => {
            for (let i = 0; i < depth; i++) await Promise.resolve();
            await t.insertMany(rows).catch((error: { code?: string }) => {
              late = error.code;
            });
          });
        })
        .then(
          () => 'committed',
          (error: { code?: string }) => error.code,
        );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(await c.has('partial-' + depth), `depth ${depth}`).toBe(false);
      expect(['committed', 'DUPLICATE_KEY', 'CLOSED', 'UNFINISHED_TRANSACTION']).toContain(outcome);
      if (outcome === 'committed') expect(late, `depth ${depth}`).toBe('CLOSED');
    }
    await db.verify();
  } finally {
    await db.close();
  }
});
it('captures values before asynchronous admission, including cyclic native objects', async () => {
  const db = await memory(),
    c = db.collection<Document & Record<string, unknown>>('native');
  const buffer = new ArrayBuffer(16);
  new Uint8Array(buffer).set([1, 2, 3, 4]);
  const shared = { x: 1 };
  const row: Document & Record<string, unknown> = {
    id: 'v',
    date: new Date(123),
    invalidDate: new Date(NaN),
    bigint: 2n ** 100n,
    map: new Map<unknown, unknown>([['x', shared]]),
    set: new Set([1, 2]),
    regex: /ab/gi,
    missing: undefined,
    nan: NaN,
    infinite: Infinity,
    negativeZero: -0,
    buffer,
    view: new Uint8Array(buffer, 1, 2),
    second: shared,
    third: shared,
  };
  row.self = row;
  const pending = c.insert(row);
  shared.x = 8;
  (row.date as Date).setTime(456);
  await pending;
  const result = (await c.get('v'))!;
  expect(result.self).toBe(result);
  expect(result.second).toBe(result.third);
  expect((result.second as { x: number }).x).toBe(1);
  expect((result.map as Map<unknown, unknown>).get('x')).toBe(result.second);
  expect(result.date).toEqual(new Date(123));
  expect(Number.isNaN((result.invalidDate as Date).getTime())).toBe(true);
  expect(result.set).toEqual(new Set([1, 2]));
  expect(result.regex).toEqual(/ab/gi);
  expect(result.view).toEqual(new Uint8Array([2, 3]));
  expect((result.view as Uint8Array).buffer).toBe(result.buffer);
  expect(result.bigint).toBe(2n ** 100n);
  expect(result.nan).toBeNaN();
  expect(Object.is(result.negativeZero, -0)).toBe(true);
  expect(Object.hasOwn(result, 'missing')).toBe(true);
  (result.second as { x: number }).x = 99;
  expect(((await c.get('v'))!.second as { x: number }).x).toBe(1);
  await c.update('v', { added: true });
  const updated = (await c.get('v'))!;
  expect(updated.self).toBe(updated);
});
it('rejects invalid documents, unsupported values and unsafe names', async () => {
  const db = await memory(),
    c = db.collection('x');
  expect(() => db.collection('../escape')).toThrow();
  expect(() => c.insert({ id: Infinity })).toThrow();
  expect(() => c.insert({ id: 'x'.repeat(513) })).toThrow();
  expect(() => c.insert(new Date() as unknown as Document)).toThrow();
  expect(() => c.insert({ id: 'a', f: () => 1 } as Document)).toThrow();
  expect(() => c.update(1, { id: 2 } as never)).toThrow();
  await c.insert({ id: 1 });
  await expect(c.update(1, (current) => ({ ...current, id: 2 }))).rejects.toMatchObject({
    code: 'INVALID_DOCUMENT',
  });
  expect(await c.has(1)).toBe(true);
});
it('accepts collection names in every script and keeps them through verify, export and import', async () => {
  const db = await memory(),
    names = ['商店', 'Café', 'Ä', 'Ä', '123', '𝒜'.repeat(32)];
  for (const [i, collection] of names.entries()) await db.collection(collection).insert({ id: i });
  const stamped = await db.ensureCollection('Bestellungen-ä', { $timestamps: true });
  await stamped.insert({ id: 'b' });
  expect(await db.collection('Ä').has(3)).toBe(false);
  expect(await db.collection('Ä').has(3)).toBe(true);
  expect(await db.collections()).toEqual([...names, 'Bestellungen-ä'].sort());
  expect((await db.verify()).documents).toBe(names.length + 1);
  const target = await memory();
  await target.import(await db.export());
  expect(await target.collections()).toEqual(await db.collections());
  expect(await target.collection('商店').get(0)).toEqual({ id: 0 });
  expect((await target.verify()).documents).toBe(names.length + 1);
  const shop = await memory();
  await shop.import(await db.export({ collections: ['商店'] }));
  expect(await shop.collections()).toEqual(['商店']);
  for (const bad of ['', '_x', '-x', 'a:b', 'a b', 'a.b', 'x'.repeat(65), '𝒜'.repeat(33), '\uD800'])
    expect(() => db.collection(bad), bad).toThrow(TypeError);
});
it('exposes the native directory-independent backend and reopens memory state', async () => {
  const backend = createMemoryBackend();
  const a = await openDatabase(backend, { name: 'shared' });
  await a.collection('x').insert({ id: 'a' });
  await a.close();
  const b = await openDatabase(backend, { name: 'shared', create: false });
  opened.push(b);
  expect(await b.collection('x').has('a')).toBe(true);
  const raw = await openDbsonl(backend, 'foreign', { create: true });
  await raw.put('x', 1);
  await raw.close();
  await expect(openDatabase(backend, { name: 'foreign' })).rejects.toMatchObject({
    code: 'SCHEMA_MISMATCH',
  });
});

describe('DataView query integration', () => {
  it('uses complex Boolean expressions, nested paths, filters, sorting and paging', async () => {
    const { c } = await seeded(),
      q = c.q;
    const request: FindRequest = {
      filters: [{ field: 'name', op: 'contains', value: 'a' }],
      where: q.or(
        q.eq(q.field('city'), q.literal('Munich')),
        q.and(q.gt(q.field('score'), q.literal(20)), q.not(q.isNullish(q.field('age')))),
      ),
      sorters: [{ field: 'score', direction: 'desc' }],
      offset: 0,
      limit: 1,
    };
    const result = await c.query(request, { count: 'exact', batchSize: 1 });
    expect(result.rows.map((row) => row.id)).toEqual(['c']);
    expect(result.summary.totalResultRows).toBe(1);
    expect(result.summary.totalInputMatches).toBe(1);
    expect(
      (await c.find({ filters: [{ field: 'nested.yes', op: 'eq', value: true }] })).map(
        (row) => row.id,
      ),
    ).toEqual(['a', 'c']);
    expect(
      await c.findOne({ filters: [{ field: 'name', op: 'eq', value: 'missing' }] }),
    ).toBeUndefined();
    expect((await c.findOne({ sorters: [{ field: 'score', dir: 'desc' }] }))?.id).toBe('b');
  });
  it('projects arithmetic and groups with HAVING, exact totals, conditional measures and BigInt', async () => {
    const { c } = await seeded(),
      q = c.q;
    const projected = await c.select(
      {
        select: { label: q.field('name'), double: q.mul(q.field('score'), q.literal(2)) },
        orderBy: [{ expr: q.field('score'), direction: 'desc' }],
      },
      { limit: 2 },
    );
    expect(projected.rows).toEqual([
      { label: 'Bob', double: 50 },
      { label: 'Carol', double: 30 },
    ]);
    const result = await c.aggregate({
      groupBy: { city: q.field('city') },
      measures: {
        count: q.count(),
        ages: q.count(q.field('age')),
        sum: q.sum(q.field('score')),
        avg: q.avg(q.field('score')),
        min: q.min(q.field('score')),
        max: q.max(q.field('score')),
        big: q.sumBigInt(q.field('n')),
        positive: q.count(undefined, { where: q.gt(q.field('score'), q.literal(0)) }),
      },
      having: [{ field: 'positive', op: 'gte', value: 2 }],
      orderBy: [{ field: 'sum', direction: 'desc' }],
    });
    expect(result.rows).toEqual([
      {
        city: 'Munich',
        count: 2,
        ages: 1,
        sum: 25,
        avg: 12.5,
        min: 10,
        max: 15,
        big: 40n,
        positive: 2,
      },
    ]);
    const view = await c.view(
      {
        select: { name: q.field('name') },
        totals: { total: q.sum(q.field('score')), count: q.count() },
        orderBy: [{ expr: q.field('score'), direction: 'desc' }],
      },
      { limit: 1 },
    );
    expect(view.rows).toEqual([{ name: 'Bob' }]);
    expect(view.totals).toEqual({ total: 50, count: 4 });
    expect(await c.count()).toBe(4);
    expect(await c.count({ where: q.gt(q.field('score'), q.literal(0)) })).toBe(3);
  });
  it('supports reusable prepared select, aggregate and view streams', async () => {
    const { c } = await seeded(),
      q = c.q;
    const plans = [
      c.prepareSelect({ select: { id: q.field('id') } }),
      c.prepareAggregate({ measures: { count: q.count() } }),
      c.prepareView({ select: { id: q.field('id') }, totals: { count: q.count() } }),
    ];
    for (const plan of plans) {
      const events = [];
      for await (const event of plan.stream(undefined, { batchSize: 1 })) events.push(event);
      expect(events.at(-1)?.type).toBe('complete');
      expect(plan.explain().kind).toBeDefined();
    }
    const dates = new Date(1),
      descriptor = {
        filters: [{ field: 'date', op: 'eq' as const, value: dates }],
        sorters: [{ field: 'id', direction: 'asc' as const }],
      };
    const find = c.prepareFind(descriptor);
    dates.setTime(77);
    descriptor.filters[0]!.field = 'score';
    expect((await find.evaluate()).rows.map((row) => row.id)).toEqual(['a', 'c']);
    const events = [];
    for await (const event of c.stream({}, { batchSize: 2 })) events.push(event);
    expect(events.at(-1)?.type).toBe('complete');
  });
  it('preserves empty-set and nullish aggregation semantics', async () => {
    const db = await memory(),
      c = db.collection<User>('empty'),
      q = c.q;
    expect(await c.count()).toBe(0);
    expect(
      (
        await c.aggregate({
          measures: { n: q.count(), sum: q.sum(q.field('score')), mean: q.avg(q.field('score')) },
        })
      ).rows,
    ).toEqual([{ n: 0, sum: null, mean: null }]);
    expect(
      (await c.aggregate({ groupBy: { city: q.field('city') }, measures: { n: q.count() } })).rows,
    ).toEqual([]);
    expect(await c.find({ limit: 0 })).toEqual([]);
  });
  it('passes document sources to external DataView plans and enforces resource/cancellation limits', async () => {
    const { c } = await seeded();
    const q = forRows<User>();
    expect(
      (await q.aggregate({ measures: { count: q.count() } }).evaluate(c.source())).rows,
    ).toEqual([{ count: 4 }]);
    await expect(c.query({}, { maxScannedRows: 2, batchSize: 1 })).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    await expect(c.query({}, { maxOutputRows: 2 })).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });
    await expect(
      c.aggregate(
        { groupBy: { city: q.field('city') }, measures: { count: q.count() } },
        undefined,
        { maxGroups: 1 },
      ),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    await expect(c.find({}, { signal: { aborted: true } })).rejects.toBeDefined();
    const iterator = c.stream({}, { batchSize: 1 });
    await iterator.next();
    await iterator.return(undefined);
    expect(await c.count()).toBe(4);
    expect(() =>
      c.prepareFind({ filters: [{ field: '__proto__.x', op: 'eq', value: 1 }] }),
    ).toThrow();
    expect(() => c.prepareFind({ where: { v: 1, op: 'eval' } })).toThrow();
  });
});

describe('secondary indexes', () => {
  it('builds, uses and maintains single/compound indexes and residual filters', async () => {
    const { c, db } = await seeded();
    await c.createIndex({ name: 'city', fields: ['city'] });
    await c.createIndex({ name: 'pair', fields: ['city', 'date'] });
    const request: FindRequest = {
      filters: [
        { field: 'city', op: 'eq', value: 'Munich' },
        { field: 'date', op: 'eq', value: new Date(1) },
        { field: 'score', op: 'gte', value: 12 },
      ],
      sorters: [{ field: 'score', direction: 'desc' }],
    };
    expect((await c.explain(request)).access).toMatchObject({ kind: 'equality', index: 'pair' });
    expect(await c.find(request)).toEqual(await c.find({ ...request, access: 'scan' }));
    expect((await c.query(request)).summary.scannedRows).toBe(2);
    expect(
      (await c.explain({ filters: [{ field: 'id', op: 'eq', value: 'b' }] })).access.kind,
    ).toBe('primary');
    await c.update('a', { city: 'Paris' });
    await c.delete('c');
    expect(await c.find(request)).toEqual([]);
    expect((await db.verify()).indexEntries).toBe(6);
    expect(await c.dropIndex('pair')).toBe(true);
    expect(await c.dropIndex('pair')).toBe(false);
    expect((await c.indexes()).map((index) => index.name)).toEqual(['city']);
  });
  it('enforces uniqueness, rolls back failed index builds, and supports nullish/binary/date values', async () => {
    const { c, db } = await seeded();
    await expect(
      c.createIndex({ name: 'uniqueCity', fields: ['city'], unique: true }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_KEY' });
    expect(await c.indexes()).toEqual([]);
    expect((await db.verify()).indexEntries).toBe(0);
    await c.createIndex({ name: 'name', fields: ['name'], unique: true });
    await c.createIndex({ name: 'name', fields: ['name'], unique: true });
    await expect(c.createIndex({ name: 'name', fields: ['city'] })).rejects.toMatchObject({
      code: 'SCHEMA_MISMATCH',
    });
    await expect(c.insert({ ...fixture[0]!, id: 'duplicate' })).rejects.toMatchObject({
      code: 'DUPLICATE_KEY',
    });
    await expect(c.update('b', { name: 'Alice' })).rejects.toMatchObject({ code: 'DUPLICATE_KEY' });
    expect((await c.get('b'))?.name).toBe('Bob');
    await c.update('a', { name: 'Alicia' });
    await c.insert({ ...fixture[0]!, id: 'new' });
    expect(
      (await c.query({ filters: [{ field: 'name', op: 'eq', value: 'Alice' }] })).summary
        .scannedRows,
    ).toBe(1);
    const native = db.collection<Document & { v: unknown }>('values');
    await native.insertMany([
      { id: 1, v: undefined },
      { id: 2, v: null },
      { id: 3, v: new Date(123) },
      { id: 4, v: new Uint8Array([1, 2]) },
      { id: 5, v: NaN },
      { id: 6, v: 0 },
    ]);
    await native.createIndex({ name: 'v', fields: ['v'], unique: true });
    for (const v of [undefined, null, new Date(123), new Uint8Array([1, 2]).buffer, NaN, -0]) {
      const filters = [{ field: 'v', op: 'eq' as const, value: v }];
      expect(await native.find({ filters })).toEqual(
        await native.find({ filters, access: 'scan' }),
      );
    }
    await expect(native.insert({ id: 7, v: -0 })).rejects.toMatchObject({ code: 'DUPLICATE_KEY' });
    await expect(native.put({ id: 7, v: {} })).rejects.toMatchObject({
      code: 'INVALID_INDEX_VALUE',
    });
    expect(await native.find({ filters: [{ field: 'v', op: 'eq', value: {} }] })).toEqual([]);
    expect(
      (
        await native.explain({
          filters: [{ field: 'v', op: 'eq', value: new Date(123) }],
          semantics: { equality: 'identity' },
        })
      ).access.kind,
    ).toBe('scan');
    await db.verify();
  });
});

describe('transactions and snapshots', () => {
  it('commits across collections, reads staged writes, and rolls back callbacks once', async () => {
    const db = await memory();
    let calls = 0;
    await expect(
      db.transaction(async (tx) => {
        calls++;
        await tx.collection('A').insert({ id: 1 });
        await tx.collection('B').insert({ id: 2 });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(calls).toBe(1);
    expect(await db.collections()).toEqual([]);
    const receipt = await db.transaction(async (tx) => {
      const c = tx.collection<Document & { n: number }>('A');
      await c.insert({ id: 1, n: 1 });
      await c.update(1, (row) => ({ ...row, n: row.n + 1 }));
      expect((await c.get(1))?.n).toBe(2);
      expect(await c.count()).toBe(1);
      await tx.collection('B').insert({ id: 2 });
      return 'done';
    });
    expect(receipt.result).toBe('done');
    expect(receipt.revision).toBeGreaterThan(0);
    expect((await db.verify()).documents).toBe(2);
  });
  it('does not commit a partially staged failed operation even when its rejection is caught', async () => {
    const db = await memory();
    await expect(
      db.transaction(async (tx) => {
        const c = tx.collection('A');
        try {
          await c.insertMany([{ id: 1 }, { id: 1 }]);
        } catch {
          /* caller attempts to continue */
        }
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_KEY' });
    expect(await db.collection('A').count()).toBe(0);
  });
  it('detects stale compare-and-swap and racing unique claims', async () => {
    const { c, db } = await seeded();
    const revision = (await db.stats()).revision;
    await c.update('a', { score: 11 });
    await expect(c.update('a', { score: 12 }, { ifRevision: revision })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const unique = db.collection<Document & { x: number }>('unique');
    await unique.createIndex({ name: 'x', fields: ['x'], unique: true });
    let arrived = 0,
      release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = (id: number) =>
      db.transaction(async (tx) => {
        await tx.collection<Document & { x: number }>('unique').insert({ id, x: 9 });
        if (++arrived === 2) release();
        await ready;
      });
    const results = await Promise.allSettled([write(1), write(2)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      (results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.code,
    ).toBe('CONFLICT');
    expect(await unique.count()).toBe(1);
    await db.verify();
  });
  it('detects query phantoms while allowing disjoint point transactions', async () => {
    const { db } = await seeded();
    let resume!: () => void, observed!: () => void;
    const gate = new Promise<void>((resolve) => {
        resume = resolve;
      }),
      seen = new Promise<void>((resolve) => {
        observed = resolve;
      });
    const tx = db.transaction(async (scope) => {
      await scope.collection('users').count();
      observed();
      await gate;
      await scope.collection('other').insert({ id: 1 });
    });
    await seen;
    await db.collection('users').insert({ id: 'new' });
    resume();
    await expect(tx).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await db.collection('other').has(1)).toBe(false);
    const results = await Promise.allSettled(
      ['a', 'b'].map((id) =>
        db.transaction(async (scope) => {
          const c = scope.collection<User>('users');
          const doc = (await c.get(id))!;
          await c.put({ ...doc, score: 99 });
        }),
      ),
    );
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
  });
  it('keeps snapshots stable across mutations, compaction and index deletion', async () => {
    const { c, db } = await seeded();
    await c.createIndex({ name: 'city', fields: ['city'] });
    const snapshot = await db.snapshot(),
      previous = snapshot.collection<User>('users');
    await c.update('a', { city: 'Paris' });
    await c.dropIndex('city');
    await db.compact();
    await db.collect();
    expect((await previous.get('a'))?.city).toBe('Munich');
    expect(await previous.count()).toBe(4);
    expect(
      (await previous.find({ filters: [{ field: 'city', op: 'eq', value: 'Munich' }] })).map(
        (row) => row.id,
      ),
    ).toEqual(['a', 'c']);
    expect((await previous.query()).summary.revision).toBe(snapshot.revision);
    await snapshot.close();
    await snapshot.close();
    await db.collect();
    await expect(previous.count()).rejects.toMatchObject({ code: 'CLOSED' });
    await db.close();
    await expect(c.find()).rejects.toMatchObject({ code: 'CLOSED' });
  });
  it('aggregates one collection and reads another by its group keys in one snapshot', async () => {
    type Order = { id: number; customer: string; amount: number };
    type Customer = { id: string; name: string };
    const db = await memory();
    await db.collection<Customer>('customers').insertMany([
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Bo' },
    ]);
    await db.collection<Order>('orders').insertMany([
      { id: 1, customer: 'a', amount: 5 },
      { id: 2, customer: 'b', amount: 7 },
      { id: 3, customer: 'a', amount: 4 },
    ]);
    const snapshot = await db.snapshot();
    // Writes after the snapshot change neither read.
    await db.collection<Order>('orders').insert({ id: 4, customer: 'b', amount: 100 });
    await db.collection<Customer>('customers').update('a', { name: 'Ada L.' });
    const orders = snapshot.collection<Order>('orders'),
      q = orders.q;
    const totals = await orders.aggregate(
      {
        groupBy: { customer: q.field('customer') },
        measures: { revenue: q.sum(q.field('amount')) },
        orderBy: [{ field: 'revenue', direction: 'desc' }],
      },
      { limit: 10 },
    );
    const customers = await snapshot
      .collection<Customer>('customers')
      .getMany(totals.rows.map((row) => row.customer));
    expect(totals.rows.map((row, i) => [customers[i]?.name, row.revenue])).toEqual([
      ['Ada', 9],
      ['Bo', 7],
    ]);
    await snapshot.close();
    await db.close();
  });
  it('updates/deletes matching rows atomically and rejects budget overruns', async () => {
    const { c, db } = await seeded();
    await c.createIndex({ name: 'city', fields: ['city'] });
    expect(
      await c.updateMany(
        { filters: [{ field: 'city', op: 'eq', value: 'Munich' }] },
        { city: 'Berlin' },
      ),
    ).toBe(2);
    expect(await c.deleteMany({ sorters: [{ field: 'score', direction: 'desc' }], limit: 2 })).toBe(
      2,
    );
    expect((await c.find()).map((row) => row.id)).toEqual(['a', 'd']);
    await db.verify();
    const small = await memory({ maxTransactionOperations: 5 });
    const s = small.collection('rows');
    await s.insert({ id: 1 });
    await s.insert({ id: 2 });
    await s.insert({ id: 3 });
    await expect(
      s.createIndex({ name: 'id', fields: ['id'], unique: true }),
    ).resolves.toBeUndefined();
    await expect(s.deleteMany()).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect(await s.count()).toBe(3);
    await small.verify();
  });
  it('rejects escaped transaction handles and unfinished operations/streams', async () => {
    const db = await memory();
    let escaped!: DatabaseTransaction;
    await db.transaction((tx) => {
      escaped = tx;
    });
    expect(() => escaped.collection('x')).toThrow();
    let handle!: TransactionCollection;
    await db.transaction((tx) => {
      handle = tx.collection('x');
    });
    await expect(handle.get(1)).rejects.toMatchObject({ code: 'CLOSED' });
    await expect(
      db.transaction(async (tx) => {
        const c = tx.collection('x');
        void c.insert({ id: 1 });
      }),
    ).rejects.toMatchObject({ code: 'UNFINISHED_TRANSACTION' });
    expect(await db.collection('x').has(1)).toBe(false);
    await db.collection('x').insert({ id: 1 });
    await expect(
      db.transaction(async (tx) => {
        const stream = tx.collection('x').stream({}, { batchSize: 1 });
        await stream.next();
      }),
    ).rejects.toMatchObject({ code: 'UNFINISHED_TRANSACTION' });
  });
});

it('matches independent JavaScript and DataView oracles across batch boundaries and indexed queries', async () => {
  const db = await memory(),
    c = db.collection<Document & { group: number; amount: number; flag: boolean }>('random');
  let state = 123456;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  const rows = Array.from({ length: 257 }, (_, id) => ({
    id: String(id).padStart(4, '0'),
    group: random() % 9,
    amount: random() % 1000,
    flag: (random() & 1) === 0,
  }));
  await c.insertMany(rows);
  await c.createIndex({ name: 'group', fields: ['group'] });
  for (const batchSize of [1, 7, 64, 512])
    for (const group of [0, 3, 8]) {
      const filters = [
        { field: 'group', op: 'eq' as const, value: group },
        { field: 'amount', op: 'gte' as const, value: 250 },
      ];
      const expected = rows
        .filter((row) => row.group === group && row.amount >= 250)
        .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
        .slice(2, 10);
      const request = {
        filters,
        sorters: [
          { field: 'amount', direction: 'desc' as const },
          { field: 'id', direction: 'asc' as const },
        ],
        offset: 2,
        limit: 8,
      };
      expect(await c.find(request, { batchSize })).toEqual(expected);
      expect(await c.find({ ...request, access: 'scan' }, { batchSize })).toEqual(expected);
    }
  const q = c.q,
    descriptor = {
      groupBy: { group: q.field('group'), flag: q.field('flag') },
      measures: { n: q.count(), sum: q.sum(q.field('amount')) },
      orderBy: [{ field: 'group' }],
    };
  expect((await c.aggregate(descriptor)).rows).toEqual(
    (await q.aggregate(descriptor).evaluate(createArraySource(rows))).rows,
  );
});

it('concurrent initialization joins the winning format commit', async () => {
  const backend = createMemoryBackend();
  const clients = await Promise.all(Array.from({ length: 16 }, () => openDatabase(backend)));
  opened.push(...clients);
  await clients[0]!.collection('ready').insert({ id: 1 });
  expect(await clients[15]!.collection('ready').has(1)).toBe(true);
});
it('passes custom size accounting the public document shape', async () => {
  const { c } = await seeded();
  let seen = 0;
  await c.find(
    {},
    {
      sizeOf: (row) => {
        expect(row.name).toBeTypeOf('string');
        return 100;
      },
      sizeOfOutput: (row) => {
        expect((row as User).name).toBeTypeOf('string');
        seen++;
        return 100;
      },
    },
  );
  expect(seen).toBeGreaterThan(0);
});

it('pulls and commits ingestion batches on demand with explicit partial progress', async () => {
  const db = await memory(),
    c = db.collection('ingest');
  let consumed = 0;
  async function* input() {
    consumed++;
    yield [{ id: 1 }, { id: 2 }];
    consumed++;
    yield [{ id: 3 }];
    consumed++;
    yield [{ id: 3 }];
  }
  const iterator = c.insertBatches(input());
  expect(consumed).toBe(0);
  const first = await iterator.next();
  expect(first.value).toMatchObject({ ids: [1, 2] });
  expect(consumed).toBe(1);
  expect(await c.count()).toBe(2);
  await iterator.next();
  expect(consumed).toBe(2);
  await expect(iterator.next()).rejects.toMatchObject({ code: 'DUPLICATE_KEY' });
  expect(await c.count()).toBe(3);
  const cancelled = c.insertBatches([[{ id: 4 }]], { signal: { aborted: true } });
  await expect(cancelled.next()).rejects.toMatchObject({ code: 'ABORTED' });
});

it('captures opening limits before asynchronous initialization', async () => {
  const options = { maxRecordBytes: 512 };
  const opening = openDatabase(createMemoryBackend(), options);
  options.maxRecordBytes = 1;
  const db = await opening;
  opened.push(db);
  await db.collection('x').insert({ id: 1 });
  expect(await db.collection('x').has(1)).toBe(true);
});
