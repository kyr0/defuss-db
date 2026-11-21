import { afterEach, expect, it } from 'vitest';
import { openMemory, openDatabase, createMemoryBackend, type Database } from '../src/index.js';
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
it('uses second-use admission, independent DSON result graphs and revision invalidation', async () => {
  const db = await memory(),
    c = db.collection<any>('rows');
  const row: any = { id: 1, n: 2, date: new Date(123), map: new Map([['x', 1]]) };
  row.self = row;
  await c.insert(row);
  const plan = c.prepareFind(),
    options = { cache: true };
  await plan.evaluate(undefined, options);
  expect(db.queryCacheStats()).toMatchObject({ misses: 1, entries: 0 });
  const result = await plan.evaluate(undefined, options);
  result.rows[0].n = 99;
  const hit = await plan.evaluate(undefined, options);
  expect(hit.rows[0].n).toBe(2);
  expect(hit.rows[0].self).toBe(hit.rows[0]);
  expect(hit.rows[0].date).toEqual(new Date(123));
  hit.rows[0].map.set('x', 9);
  expect((await plan.evaluate(undefined, options)).rows[0].map.get('x')).toBe(1);
  expect(db.queryCacheStats()).toMatchObject({ hits: 2, misses: 2 });
  const snapshot = await db.snapshot();
  await c.update(1, { n: 3 });
  expect((await c.find({}, options))[0].n).toBe(3);
  expect((await snapshot.collection<any>('rows').find({}, options))[0].n).toBe(2);
  await snapshot.close();
  db.clearQueryCache();
  expect(db.queryCacheStats()?.entries).toBe(0);
});
it('isolates descriptors, pages, collection names and query budgets', async () => {
  const db = await memory({ queryCache: { admission: 'always' } }),
    c = db.collection<any>('rows');
  await c.insertMany([
    { id: 1, n: 1 },
    { id: 2, n: 2 },
    { id: 3, n: 3 },
  ]);
  const request = { filters: [{ field: 'n', op: 'gte' as const, value: 2 }], limit: 1 };
  const plan = c.prepareFind(request);
  request.filters[0]!.value = 99;
  expect((await plan.evaluate(undefined, { cache: true })).rows[0].id).toBe(2);
  expect((await plan.evaluate(undefined, { cache: true })).rows[0].id).toBe(2);
  expect((await plan.evaluate({ offset: 1, limit: 1 }, { cache: true })).rows[0].id).toBe(3);
  expect(await c.find(request, { cache: true })).toEqual([]);
  await c.find({}, { cache: true });
  await expect(c.find({}, { cache: true, maxScannedRows: 1 })).rejects.toThrow();
  await expect(c.find({}, { cache: 'bad' as never })).rejects.toThrow();
  const controller = new AbortController();
  controller.abort();
  await expect(c.find({}, { cache: true, signal: controller.signal })).rejects.toThrow();
  expect(await db.collection('other').find({}, { cache: true })).toEqual([]);
});
it('caches projections, aggregates, views and counts while preserving summaries', async () => {
  const db = await memory({ queryCache: { admission: 'always' } }),
    c = db.collection<any>('rows'),
    q = c.q;
  await c.insertMany([
    { id: 1, n: 2 },
    { id: 2, n: 3 },
  ]);
  const calls = [
    () => c.select({ select: { n: q.field('n') } }, undefined, { cache: true }),
    () =>
      c.aggregate({ measures: { n: q.count(), sum: q.sum(q.field('n')) } }, undefined, {
        cache: true,
      }),
    () =>
      c.view(
        { select: { n: q.field('n') }, totals: { n: q.count() } },
        { limit: 1 },
        { cache: true },
      ),
    () => c.count({}, { cache: true }),
  ];
  for (const call of calls) expect(await call()).toEqual(await call());
  expect(db.queryCacheStats()?.hits).toBe(4);
  await c.count({}, { cache: 'refresh' });
  expect(db.queryCacheStats()?.misses).toBe(5);
});
it('bypasses transactions, streams, opaque identity operands and custom measurement functions', async () => {
  const db = await memory({ queryCache: { admission: 'always' } }),
    c = db.collection<any>('rows');
  await c.insert({ id: 1, n: 1 });
  await c.find({}, { cache: true });
  const before = db.queryCacheStats();
  await db.transaction(async (tx) => {
    const rows = tx.collection<any>('rows');
    expect((await rows.find({}, { cache: true }))[0].n).toBe(1);
    await rows.update(1, { n: 2 });
    expect((await rows.find({}, { cache: true }))[0].n).toBe(2);
  });
  for await (const _ of c.stream({}, { cache: true })) {
  }
  await c.find({ semantics: { equality: 'identity' } }, { cache: true });
  await c.find({}, { cache: true, sizeOf: () => 1 });
  expect(db.queryCacheStats()).toMatchObject({
    hits: before!.hits,
    misses: before!.misses,
    entries: before!.entries,
  });
  const disabled = await memory({ queryCache: false });
  expect(disabled.queryCacheStats()).toBeUndefined();
  expect(await disabled.collection('x').find({}, { cache: true })).toEqual([]);
  const cyc: any = {};
  cyc.self = cyc;
  for (const value of [
    cyc,
    { op: 'literal', value: {} },
    { op: 'literal', value: new Map() },
    { equality: 'identity' },
    {
      get x() {
        throw new Error('getter invoked');
      },
    },
    { callback: () => 1 },
  ])
    expect(cacheDescriptor(value)).toBeUndefined();
});
it('observes another database handle rather than serving a stale live revision', async () => {
  const backend = createMemoryBackend(),
    a = await openDatabase(backend, { queryCache: { admission: 'always' } }),
    b = await openDatabase(backend);
  handles.push(a, b);
  await a.collection<any>('x').put({ id: 1, n: 1 });
  await a.collection('x').find({}, { cache: true });
  await b.collection<any>('x').put({ id: 1, n: 2 });
  expect((await a.collection<any>('x').find({}, { cache: true }))[0].n).toBe(2);
});
it('enforces byte/count bounds, eviction, refresh, epochs and oversized-result fallback', async () => {
  expect(() => new QueryCache({ maxEntries: 0 })).toThrow();
  expect(() => new QueryCache({ policy: 'bad' as never })).toThrow();
  for (const policy of ['lru', 'slru'] as const) {
    const cache = new QueryCache({
      maxEntries: 3,
      maxBytes: 1600,
      maxEntryBytes: 1000,
      policy,
      admission: 'always',
    });
    for (const key of ['a', 'b', 'c']) {
      const hit = cache.lookup(key);
      cache.put(key, [key], hit.epoch);
      cache.lookup(key);
    }
    cache.put('d', ['d'], cache.epoch);
    expect(cache.stats().entries).toBe(3);
    expect(cache.stats().evictions).toBe(1);
    cache.put('large', 'x'.repeat(2000), cache.epoch);
    cache.put('fn', () => 1, cache.epoch);
    expect(cache.stats().rejections).toBe(2);
    const epoch = cache.epoch;
    cache.clear();
    cache.put('late', 1, epoch);
    expect(cache.stats().entries).toBe(0);
  }
  const bounded = new QueryCache({ maxEntries: 2, maxBytes: 512, maxEntryBytes: 300 });
  for (let i = 0; i < 100; i++) bounded.lookup(`${i}`);
  expect(bounded.stats().bytes).toBeLessThanOrEqual(512);
  expect(bounded.stats().historyEntries).toBeLessThanOrEqual(4);
  const db = await memory({ queryCache: { maxEntryBytes: 64, admission: 'always' } });
  await db.collection<any>('x').put({ id: 1, text: 'x'.repeat(100) });
  expect((await db.collection('x').find({}, { cache: true })).length).toBe(1);
  expect(db.queryCacheStats()?.entries).toBe(0);
});
it('captures pages and resource options before asynchronous cache admission', async () => {
  const db = await memory({ queryCache: { admission: 'always' } }),
    c = db.collection<any>('rows');
  await c.insertMany([
    { id: 1, n: 1 },
    { id: 2, n: 2 },
    { id: 3, n: 3 },
  ]);
  const plan = c.prepareSelect({ select: { n: c.q.field('n') } });
  const page = { limit: 1 },
    options = { cache: true, maxOutputRows: 1 };
  const pending = plan.evaluate(page, options);
  page.limit = 3;
  options.maxOutputRows = 3;
  expect((await pending).rows).toEqual([{ n: 1 }]);
  expect((await plan.evaluate({ limit: 1 }, { cache: true, maxOutputRows: 1 })).rows).toEqual([
    { n: 1 },
  ]);
  expect(db.queryCacheStats()?.hits).toBe(1);
});
