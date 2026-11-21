import { afterEach, expect, it } from 'vitest';
import { openDbsonl, DEFAULT_OPTIONS } from 'defuss-dbsonl';
import { openMemory, createMemoryBackend, Database } from '../src/index.js';
import { QueryCache, cacheDescriptor } from '../src/query-cache.js';

const handles: Database[] = [];
async function memory(options: Parameters<typeof openMemory>[0] = {}) {
  const db = await openMemory(options);
  handles.push(db);
  return db;
}
afterEach(async () => {
  for (const db of handles.splice(0)) await db.close();
});
const fixture = Array.from({ length: 512 }, (_, id) => ({
  id,
  group: id % 8,
  n: id,
  at: new Date(id),
}));
async function seeded(options: Parameters<typeof openMemory>[0] = {}) {
  const db = await memory(options),
    c = db.collection<any>('rows');
  await c.insertMany(fixture);
  return { db, c };
}

it('automatically admits repeated reducing queries and reuses plans across live collection handles', async () => {
  const { db, c } = await seeded(),
    q = c.q;
  const descriptor = { groupBy: { group: q.field('group') }, measures: { n: q.count() } };
  const first = await c.aggregate(descriptor);
  expect(db.queryCacheStats()).toMatchObject({ entries: 0, plans: 1, planMisses: 1 });
  expect(await db.collection('rows').aggregate(descriptor)).toEqual(first);
  expect(await c.aggregate(descriptor)).toEqual(first);
  expect(db.queryCacheStats()).toMatchObject({ hits: 1, misses: 2, admissions: 1, planHits: 2 });
  const snapshot = await db.snapshot();
  await c.update(0, { group: 9 });
  expect((await c.aggregate(descriptor)).rows.length).toBe(9);
  expect(db.queryCacheStats()?.invalidations).toBe(1);
  expect((await snapshot.collection('rows').aggregate(descriptor)).rows).toEqual(first.rows);
  await snapshot.close();
});
it('bypasses automatic serialization for tiny scans/full outputs and supports manual/forced modes', async () => {
  const { db, c } = await seeded();
  for (let i = 0; i < 3; i++) await c.find();
  expect(db.queryCacheStats()).toMatchObject({
    entries: 0,
    historyEntries: 0,
    autoBypasses: 3,
    planHits: 2,
  });
  for (let i = 0; i < 3; i++) await c.find({}, { cache: true });
  expect(db.queryCacheStats()).toMatchObject({ entries: 1, hits: 1 });
  const tiny = await memory();
  await tiny.collection('x').insert({ id: 1 });
  for (let i = 0; i < 3; i++) await tiny.collection('x').count();
  expect(tiny.queryCacheStats()).toMatchObject({ entries: 0, autoBypasses: 3 });
  const manual = await seeded({ queryCache: { mode: 'manual' } });
  for (let i = 0; i < 3; i++) await manual.c.count();
  expect(manual.db.queryCacheStats()).toMatchObject({ hits: 0, misses: 0, plans: 0 });
  for (let i = 0; i < 3; i++) await manual.c.count({}, { cache: 'auto' });
  expect(manual.db.queryCacheStats()?.hits).toBe(1);
  db.clearQueryCache();
  await c.count({}, { cache: false });
  expect(db.queryCacheStats()).toMatchObject({ entries: 0, plans: 0 });
});
it('preserves projection property order, native literal identity and mutable descriptor capture', async () => {
  const { db, c } = await seeded(),
    q = c.q;
  const a = await c.select(
    { select: { a: q.field('n'), b: q.field('group') } },
    { limit: 1 },
    { cache: true },
  );
  const b = await c.select(
    { select: { b: q.field('group'), a: q.field('n') } },
    { limit: 1 },
    { cache: true },
  );
  expect(Object.keys(a.rows[0]!)).toEqual(['a', 'b']);
  expect(Object.keys(b.rows[0]!)).toEqual(['b', 'a']);
  const date = new Date(123),
    literal = q.literal(date),
    desc = { select: { d: literal, e: literal } };
  const native = await c.select(desc, { limit: 1 });
  native.rows[0]!.d.setTime(999);
  expect((await c.select(desc, { limit: 1 })).rows[0]!.d.getTime()).toBe(123);
  const mutable = { filters: [{ field: 'group', op: 'eq' as const, value: 1 }], limit: 1 };
  const prepared = c.prepareFind(mutable);
  mutable.filters[0]!.value = 2;
  expect((await prepared.evaluate()).rows[0].group).toBe(1);
  expect((await c.find(mutable))[0].group).toBe(2);
  const withValue = { select: { value: q.field('n') } };
  await c.select(withValue, { limit: 1 }, { cache: true });
  const hits = db.queryCacheStats()!.planHits;
  await c.select(withValue, { limit: 1 }, { cache: true });
  expect(db.queryCacheStats()!.planHits).toBe(hits + 1);
  const plan = c.prepareFind();
  expect(Object.isFrozen(plan)).toBe(true);
  expect(() => {
    plan.evaluate = (() => null) as never;
  }).toThrow();
  const hidden = Object.defineProperty({ a: q.field('n') }, 'b', {
    value: q.field('group'),
    enumerable: false,
  });
  const before = db.queryCacheStats()!.plans;
  expect(Object.keys((await c.select({ select: hidden }, { limit: 1 })).rows[0]!)).toEqual(['a']);
  expect(db.queryCacheStats()!.plans).toBe(before);
  expect(db.queryCacheStats()!.plans).toBeLessThanOrEqual(64);
});
it('bounds plan memory/count and validates cache options and exact key encodings', async () => {
  const { db, c } = await seeded({ queryCache: { maxPlans: 2, maxPlanBytes: 8192 } });
  for (let i = 0; i < 8; i++)
    await c.find({ filters: [{ field: 'group', op: 'eq', value: i }], limit: 1 });
  expect(db.queryCacheStats()!.plans).toBe(2);
  expect(db.queryCacheStats()!.planBytes).toBeLessThanOrEqual(8192);
  for (const options of [
    { mode: 'bad' },
    { maxOutputRatio: 0 },
    { maxOutputRatio: 2 },
    { maxPendingQueries: 0 },
    { minScannedRows: 0 },
    { maxPlans: 0 },
  ])
    expect(() => new QueryCache(options as never)).toThrow();
  const values = [
    undefined,
    null,
    false,
    true,
    0,
    -0,
    1,
    1n,
    '1',
    NaN,
    Infinity,
    -Infinity,
    new Date(1),
    new Uint8Array([1]),
    { a: 1 },
    [1],
  ];
  expect(new Set(values.map((value) => cacheDescriptor({ filter: value }))).size).toBe(
    values.length,
  );
  expect(cacheDescriptor({ deep: 'x'.repeat(100) }, 16)).toBeUndefined();
  expect(cacheDescriptor({ value: () => 1 })).toBeUndefined();
  const sparse: unknown[] = [];
  sparse.length = 2;
  sparse[1] = 1;
  expect(cacheDescriptor(sparse)).toBeUndefined();
  // Inherited array methods can change compilation behavior; do not key subclasses as plain arrays.
  class CustomArray extends Array<number> {}
  expect(cacheDescriptor(new CustomArray(1, 2))).toBeUndefined();
  expect(
    cacheDescriptor({ select: { d: { v: 1, op: 'literal', value: new Date() } } }),
  ).toBeUndefined();
});

async function instrumented() {
  const raw = await openDbsonl(createMemoryBackend(), 'instrumented', { create: true });
  const { FORMAT_VERSION } = await import('../src/format.js');
  await raw.put('!defuss-db-format', {
    format: 'defuss-db',
    version: FORMAT_VERSION,
    id: crypto.randomUUID(),
  });
  let scans = 0;
  let gate: Promise<void> | undefined, entered: (() => void) | undefined;
  const proxy = new Proxy(raw, {
    get(target, key) {
      if (key === 'beginRead')
        return async () => {
          const reader = await target.beginRead();
          return new Proxy(reader, {
            get(session, property) {
              if (property === 'scanBatches')
                return (options: Parameters<typeof reader.scanBatches>[0]) => {
                  scans++;
                  const iterator = session.scanBatches(options);
                  return (async function* () {
                    entered?.();
                    if (gate) await gate;
                    yield* iterator;
                  })();
                };
              const value = Reflect.get(session, property);
              return typeof value === 'function' ? value.bind(session) : value;
            },
          });
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const db = new Database(proxy, DEFAULT_OPTIONS);
  handles.push(db);
  const c = db.collection<any>('rows');
  await c.insertMany(fixture);
  return {
    db,
    c,
    scans: () => scans,
    pause() {
      let resume!: () => void;
      gate = new Promise<void>((r) => {
        resume = r;
      });
      const seen = new Promise<void>((r) => {
        entered = r;
      });
      return { seen, resume };
    },
  };
}
it('coalesces identical signal-free misses into one real storage scan with independent results', async () => {
  const { db, c, scans } = await instrumented(),
    q = c.q;
  const descriptor = { groupBy: { group: q.field('group') }, measures: { n: q.count() } };
  const results = await Promise.all(Array.from({ length: 8 }, () => c.aggregate(descriptor)));
  expect(scans()).toBe(1);
  expect(db.queryCacheStats()).toMatchObject({ pendingQueries: 0, entries: 1 });
  expect(db.queryCacheStats()!.coalesced).toBeGreaterThan(0);
  expect(db.queryCacheStats()!.coalesced + db.queryCacheStats()!.hits).toBe(7);
  for (const result of results) expect(result.rows).toEqual(results[0]!.rows);
  results[0]!.rows[0]!.n = 0;
  expect(results[1]!.rows[0]!.n).toBe(64);
  expect((await c.aggregate(descriptor)).rows[0]!.n).toBe(64);
});
it('shares failures without leaks and isolates cancellation/resource limits', async () => {
  const { db, c, scans } = await instrumented(),
    q = c.q;
  const invalid = { measures: { sum: q.sum(q.div(q.field('n'), q.literal(0))) } };
  const failures = await Promise.allSettled([c.aggregate(invalid), c.aggregate(invalid)]);
  expect(failures.every((r) => r.status === 'rejected')).toBe(true);
  expect(db.queryCacheStats()!.pendingQueries).toBe(0);
  const descriptor = { measures: { n: q.count() } },
    before = scans();
  const signal = new AbortController().signal;
  const results = await Promise.all([
    c.aggregate(descriptor, undefined, { signal }),
    c.aggregate(descriptor, undefined, { signal }),
  ]);
  expect(results[0]!.rows[0]!.n).toBe(512);
  expect(scans() - before).toBe(2);
  db.clearQueryCache();
  const budgets = await Promise.allSettled([
    c.aggregate(descriptor, undefined, { maxScannedRows: 1 }),
    c.aggregate(descriptor),
  ]);
  expect(budgets[0]!.status).toBe('rejected');
  expect(budgets[1]!.status).toBe('fulfilled');
});
it('clear invalidates in-flight admission and leaves pending callers able to finish', async () => {
  const { db, c, pause } = await instrumented(),
    gate = pause();
  const pending = c.count();
  await gate.seen;
  expect(db.queryCacheStats()!.pendingQueries).toBe(1);
  db.clearQueryCache();
  gate.resume();
  expect(await pending).toBe(512);
  expect(db.queryCacheStats()).toMatchObject({
    entries: 0,
    plans: 0,
    pendingQueries: 0,
    pendingBytes: 0,
  });
});
it('does not retain snapshot-bound plans or cache transaction overlays', async () => {
  const { db, c } = await seeded();
  const snapshot = await db.snapshot(),
    before = db.queryCacheStats()!.plans;
  await snapshot.collection('rows').count();
  expect(db.queryCacheStats()!.plans).toBe(before);
  await snapshot.close();
  await db.transaction(async (tx) => {
    const t = tx.collection<any>('rows');
    expect(await t.count()).toBe(512);
    await t.insert({ id: 'staged' });
    expect(await t.count()).toBe(513);
  });
  expect(await c.count()).toBe(513);
});
it('avoids automatic keying for primary equality and executes profiling requests', async () => {
  const { db, c } = await seeded();
  for (let i = 0; i < 3; i++)
    expect((await c.find({ filters: [{ field: 'id', op: 'eq', value: 17 }] }))[0].n).toBe(17);
  expect(db.queryCacheStats()).toMatchObject({ plans: 0, misses: 0, hits: 0 });
  await c.count({}, { profile: true });
  await c.count({}, { profile: true });
  expect(db.queryCacheStats()).toMatchObject({ plans: 0, misses: 0, hits: 0 });
  await c.count({}, { cache: true, profile: true });
  await c.count({}, { cache: true, profile: true });
  await c.count({}, { cache: true, profile: true });
  expect(db.queryCacheStats()!.hits).toBe(1);
});
