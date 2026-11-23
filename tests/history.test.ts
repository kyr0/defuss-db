import { afterEach, expect, it } from 'vitest';
import {
  openMemory,
  openDatabase,
  createMemoryBackend,
  type Database,
  type SearchIndexDefinition,
} from '../src/index.js';
import { openDbsonl } from 'defuss-dbsonl';
const opened: Database[] = [];
async function memory() {
  const db = await openMemory();
  opened.push(db);
  return db;
}
const dt = (n: number) => new Date(n);
type Price = { id: string | number | bigint; amount: number; group?: string };
async function fixture() {
  const db = await memory(),
    c = await db.ensureCollection<Price>('prices', { $trackHistory: true });
  return { db, c };
}
afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.close()));
});
it('keeps the history of an ID apart from IDs that extend it with the key separator', async () => {
  const { c } = await fixture();
  // VERIFIED: history keys put the ID token in front of '!', so a raw 'a!b' token would fall inside the range of 'a'.
  for (const [id, amount] of [
    ['a', 1],
    ['a!b', 2],
    ['a!', 3],
    ['a"', 4],
  ] as const) {
    await c.at(dt(0)).put({ id, amount });
    await c.at(dt(10)).put({ id, amount: amount * 10 });
  }
  for (const [id, amount] of [
    ['a', 1],
    ['a!b', 2],
    ['a!', 3],
    ['a"', 4],
  ] as const) {
    // Newest segment first.
    expect((await c.history(id)).map((r) => r.document?.amount)).toEqual([amount * 10, amount]);
    expect((await c.audit(id)).map((e) => e.document?.id)).toEqual([id, id]);
  }
});
it('resolves half-open corrections, tombstones, reinsertion and original committed beliefs', async () => {
  const { db, c } = await fixture();
  await c.at(dt(-10)).put({ id: 'x', amount: 10 });
  await c.at(dt(20)).put({ id: 'x', amount: 20 });
  const before = (await db.stats()).revision;
  await c.update('x', { amount: 30 }, { $historic: dt(0), $until: dt(8) });
  expect(
    await Promise.all(
      [-11, -10, -1, 0, 7, 8, 19, 20, 300].map(
        async (t) => (await c.get('x', { $historic: dt(t) }))?.amount,
      ),
    ),
  ).toEqual([undefined, 10, 10, 30, 30, 10, 10, 20, 20]);
  expect((await c.at(dt(4), { $asOfRevision: before }).get('x'))?.amount).toBe(10);
  expect(await c.at(dt(9)).delete('x')).toBe(true);
  expect(await c.at(dt(10)).delete('x')).toBe(false);
  expect(await c.at(dt(19)).has('x')).toBe(false);
  expect(await c.has('x')).toBe(true);
  await c.at(dt(10)).insert({ id: 'x', amount: 40 });
  expect((await c.get('x'))?.amount).toBe(20);
  await expect(c.at(dt(10)).insert({ id: 'x', amount: 90 })).rejects.toMatchObject({
    code: 'DUPLICATE_KEY',
  });
  await expect(c.at(dt(11), { $until: dt(21) }).put({ id: 'x', amount: 50 })).rejects.toMatchObject(
    { code: 'HISTORY_RANGE' },
  );
  expect(
    (await c.history('x')).map((r) => [+r.from, r.until && +r.until, r.document?.amount]),
  ).toEqual([
    [20, null, 20],
    [10, 20, 40],
    [9, 10, undefined],
    [8, 9, 10],
    [0, 8, 30],
    [-10, 0, 10],
  ]);
  const audit = await c.audit('x', { limit: 3 });
  expect(audit.map((r) => r.kind)).toEqual(['put', 'delete', 'put']);
  expect(audit[2]!.recorded.storeId).toBe(db.storeId);
  expect(audit[2]!.until?.valueOf()).toBe(8);
  await db.verify();
});
it('establishes atomic baseline coverage, checks old handles, and captures dates and DSON input', async () => {
  const db = await memory(),
    c = db.collection<any>('docs');
  const row: any = {
    id: 1,
    amount: 10,
    $historic: 'data',
    $trackHistory: true,
    map: new Map([[1, 3n]]),
    bin: new Uint8Array([3]),
  };
  row.self = row;
  await c.put(row);
  await expect(c.at(dt(1)).get(1)).rejects.toMatchObject({ code: 'HISTORY_NOT_ENABLED' });
  // Real clock bounds: activation and every later write happen at or after t.
  const t = Date.now();
  const prior = (await db.stats()).revision;
  await db.ensureCollection('docs', { $trackHistory: true });
  await db.ensureCollection('docs', { $trackHistory: true });
  await expect(db.ensureCollection('docs', { $trackHistory: false })).rejects.toMatchObject({
    code: 'SCHEMA_MISMATCH',
  });
  await expect(c.at(dt(t - 1)).get('missing')).rejects.toMatchObject({
    code: 'HISTORY_UNAVAILABLE',
  });
  await expect(c.at(dt(t), { $asOfRevision: prior }).get(1)).rejects.toMatchObject({
    code: 'HISTORY_UNAVAILABLE',
  });
  await c.update(1, (doc: any) => {
    doc.amount = 20;
    return doc;
  });
  const past = await c.audit(1);
  expect(past.map((x) => x.kind)).toEqual(['put', 'seed']);
  expect(past[1]!.document.self).toBe(past[1]!.document);
  expect(past[1]!.document.map.get(1)).toBe(3n);
  expect(past[1]!.document.$historic).toBe('data');
  const now = Date.now(),
    later = now + 60_000,
    date = dt(now),
    read = c.get(1, { $historic: date });
  date.setTime(0);
  expect((await read).amount).toBe(20);
  await expect(c.at(dt(later)).update('absent', {})).rejects.toMatchObject({
    code: 'HISTORY_FUTURE_WRITE',
  });
  await expect(c.at(dt(later)).delete('absent')).rejects.toMatchObject({
    code: 'HISTORY_FUTURE_WRITE',
  });
  expect(() => c.at(new Date(NaN))).toThrow();
  expect(() => c.at(42 as any)).toThrow();
  await expect(c.at(dt(now), { $until: dt(later) }).put({ id: 1 })).rejects.toMatchObject({
    code: 'HISTORY_FUTURE_WRITE',
  });
  await expect(c.at(dt(t), { $asOfRevision: 1e8 }).get(1)).rejects.toMatchObject({
    code: 'HISTORY_UNAVAILABLE',
  });
  await db.verify();
});
it('orders same-millisecond writes within transactions, preserves pinned snapshots and rejects past-basis writes', async () => {
  const backend = createMemoryBackend(),
    db = await openDatabase(backend);
  opened.push(db);
  const c = await db.ensureCollection<Price>('prices', { $trackHistory: true });
  const receipt = await db.transaction(async (tx) => {
    const prices = tx.collection<Price>('prices');
    await prices.put({ id: 1, amount: 1 });
    await prices.update(1, { amount: 2 });
    const now = dt(Date.now());
    expect((await prices.at(now).get(1))!.amount).toBe(2);
    expect(await prices.at(now, { $asOfRevision: tx.revision }).has(1)).toBe(false);
    await tx.collection('other').put({ id: 1 });
  });
  // All tracked writes of one transaction share its clock.
  const t = +(await c.audit(1))[0]!.from;
  const snap = await db.snapshot();
  // A system clock behind the stored history clock, as after the clock was set back: the next write must not
  // record an earlier time. The stored clock is moved ahead instead of the system clock moved back.
  const ahead = Date.now() + 60_000,
    raw = await openDbsonl<{ ms: number; seq: number }>(backend, 'default');
  await raw.transaction(async (tx) => {
    const stored = await tx.get('!history-clock');
    tx.put('!history-clock', { ...stored.value!, ms: ahead });
  });
  await raw.close();
  await c.update(1, { amount: 3 });
  await db.compact();
  await db.collect();
  expect((await snap.collection<Price>('prices').at(dt(t)).get(1))!.amount).toBe(2);
  expect((await c.at(dt(t), { $asOfRevision: receipt.revision }).get(1))!.amount).toBe(2);
  const audit = await c.audit(1);
  expect(audit.map((a) => +a.from)).toEqual([ahead, t, t]);
  expect(audit[1]!.revision).toBe(audit[2]!.revision);
  expect(audit[1]!.ordinal).toBeGreaterThan(audit[2]!.ordinal);
  await expect(
    c.put({ id: 1, amount: 8 }, { $historic: dt(t), $asOfRevision: receipt.revision }),
  ).rejects.toMatchObject({ code: 'HISTORY_READ_ONLY' });
  await snap.close();
  await db.verify();
});
it('uses historical candidates for compound queries, updates, deletes, projections, aggregates, prepared streams and totals', async () => {
  const { db, c } = await fixture(),
    q = c.q;
  await c.at(dt(1)).insertMany([
    { id: 1, amount: 10, group: 'x' },
    { id: 1n, amount: 20, group: 'x' },
    { id: '1', amount: 40, group: 'y' },
  ]);
  await c.at(dt(8)).update(1, { group: 'y' });
  await c.at(dt(8)).delete('1');
  const v = c.at(dt(4)),
    options = { $historic: dt(4) },
    sel = { filters: [{ field: 'group', op: 'eq' as const, value: 'x' }] };
  expect(await v.getMany([1n, '1', 1, 7])).toEqual([
    { id: 1n, amount: 20, group: 'x' },
    { id: '1', amount: 40, group: 'y' },
    { id: 1, amount: 10, group: 'x' },
    undefined,
  ]);
  expect((await c.find({ ...sel, ...options })).map((r) => r.id)).toEqual([1n, 1]);
  expect(await c.count(sel, options)).toBe(2);
  expect((await c.prepareFind(sel).evaluate(undefined, options)).rows).toHaveLength(2);
  const select = { select: { v: q.field('amount') } };
  expect((await c.select(select, undefined, options)).rows.map((r) => r.v)).toEqual([20, 10, 40]);
  expect(
    (
      await c.aggregate(
        { groupBy: { g: q.field('group') }, measures: { s: q.sum(q.field('amount')) } },
        undefined,
        options,
      )
    ).rows,
  ).toEqual([
    { g: 'x', s: 30 },
    { g: 'y', s: 40 },
  ]);
  expect((await v.view({ ...select, totals: { n: q.count() } })).totals.n).toBe(3);
  const parts = [];
  for await (const batch of c.prepareFind(sel).stream(undefined, options))
    if (batch.type === 'batch') parts.push(...batch.rows);
  expect(parts).toHaveLength(2);
  expect(await c.updateMany(sel, (old) => ({ ...old, amount: old.amount + 1 }), options)).toBe(2);
  expect((await v.get(1))!.amount).toBe(11);
  expect((await c.get(1))!.amount).toBe(10);
  expect(await v.deleteMany({ filters: [{ field: 'amount', op: 'gt', value: 20 }] })).toBe(2);
  expect(await v.count()).toBe(1);
  expect((await c.explain(options)).history!.effective).toEqual(dt(4));
  await db.verify();
});
it('pins historical continuations across a correction, index removal, compaction and cross-shape resume', async () => {
  const { db, c } = await fixture();
  await c.at(dt(1)).insertMany([
    { id: 1, amount: 3 },
    { id: 10, amount: 3 },
    { id: 1n, amount: 2 },
    { id: '1', amount: 4 },
  ]);
  await c.createIndex({ name: 'feed', fields: ['amount'], order: ['asc'] });
  const v = c.at(dt(2)),
    first = await v.pageIdsByIndex('feed', { limit: 2 });
  expect(first.rows).toEqual([1n, 1]);
  expect(await c.countByIndex('feed', { $historic: dt(2), gte: 3 })).toBe(3);
  await expect(v.countByIndex('feed', { maxScannedEntries: 2 })).rejects.toThrow();
  await c.at(dt(2)).update(10, { amount: 0 });
  await c.dropIndex('feed');
  await db.compact();
  const next = await v.pageByIndex('feed', { after: first.nextCursor!, limit: 3 });
  expect(next.revision).toBe(first.revision);
  expect(next.rows.map((r) => r.id)).toEqual([10, '1']);
  expect(next.rows[0]!.amount).toBe(3);
  await expect(v.pageByIndex('feed')).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  await expect(
    c.at(dt(3)).pageIdsByIndex('feed', { after: first.nextCursor! }),
  ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  expect(db.queryCacheStats()!.temporalIndexes).toBeGreaterThan(0);
  db.clearQueryCache();
  expect(db.queryCacheStats()!.temporalIndexBytes).toBe(0);
});
it('separates cached effective dates, recorded cutoffs, current data and caller-owned graphs', async () => {
  const { db, c } = await fixture();
  await c.at(dt(1)).put({ id: 1, amount: 2 });
  await c.at(dt(5)).put({ id: 1, amount: 5 });
  const stamp = (await db.stats()).revision;
  const q = c.q,
    desc = { measures: { total: q.sum(q.field('amount')) } };
  for (const t of [2, 6, 2, 6]) {
    const result = await c.aggregate(desc, undefined, { $historic: dt(t), cache: true });
    expect(result.rows[0]!.total).toBe(t === 2 ? 2 : 5);
    result.rows[0]!.total = 999;
  }
  await c.at(dt(2)).put({ id: 1, amount: 3 });
  expect((await c.at(dt(2), { $asOfRevision: stamp }).aggregate(desc)).rows[0]!.total).toBe(2);
  expect((await c.at(dt(2)).aggregate(desc)).rows[0]!.total).toBe(3);
  expect((await c.aggregate(desc)).rows[0]!.total).toBe(5);
});
it('distinguishes live uniqueness and non-overlapping historical uniqueness, including backfill', async () => {
  const { db, c } = await fixture();
  await c.createIndex({ name: 'live', fields: ['amount'], unique: true });
  await c.at(dt(1)).put({ id: 'a', amount: 1 });
  await c.at(dt(8)).put({ id: 'a', amount: 8 });
  await c.at(dt(4)).put({ id: 'b', amount: 1 });
  expect(
    (await c.at(dt(5)).find({ filters: [{ field: 'amount', op: 'eq', value: 1 }] })).map(
      (r) => r.id,
    ),
  ).toEqual(['a', 'b']);
  await expect(
    c.createIndex({ name: 'per_time', fields: ['amount'], temporalUnique: true }),
  ).rejects.toMatchObject({ code: 'DUPLICATE_KEY' });
  await c.at(dt(4), { $until: dt(8) }).update('b', { amount: 3 });
  await c.createIndex({ name: 'per_time', fields: ['amount'], temporalUnique: true });
  await expect(c.at(dt(4)).update('b', { amount: 1 })).rejects.toMatchObject({
    code: 'DUPLICATE_KEY',
  });
  await expect(
    db.collection('off').createIndex({ name: 'u', fields: ['x'], temporalUnique: true }),
  ).rejects.toMatchObject({ code: 'HISTORY_NOT_ENABLED' });
  await db.verify();
});
it('rebuilds upstream lexical, vector and hybrid engines over the effective corpus before ranking or top-k', async () => {
  const db = await memory();
  type Entry = { id: number; text: string; vector: number[] };
  const c = await db.ensureCollection<Entry>('items', { $trackHistory: true }),
    ref = db.collection<Entry>('ref');
  const old = [
    { id: 1, text: 'amber owl', vector: [1, 0] },
    { id: 2, text: 'amber', vector: [0.7, 0.3] },
    { id: 3, text: 'oak', vector: [0, 1] },
  ];
  await c.at(dt(1)).insertMany(old);
  await ref.insertMany(old);
  const text = { fields: { text: { path: 'text' } } },
    vector = { path: 'vector', dimensions: 2 };
  const defs: SearchIndexDefinition[] = [
    { name: 'l', kind: 'lexical', text },
    { name: 'v', kind: 'vector', vector },
    { name: 'm', kind: 'hybrid', text, vector },
  ];
  for (const d of defs) {
    await c.createSearchIndex(d);
    await ref.createSearchIndex(d);
  }
  await c.at(dt(20)).delete(2);
  await c.at(dt(20)).put({ id: 4, text: 'amber amber', vector: [1, 0] });
  await c.at(dt(20)).put({ id: 1, text: 'oak', vector: [0, 1] });
  for (const def of defs) {
    const query = def.kind === 'lexical' ? 'amber' : { text: 'amber', vector: [1, 0] };
    const answers = (h: { hits: { id: number; score: number }[] }) =>
      h.hits.map((r) => [r.id, r.score]);
    const historical = await c.search(def.name, query, { $historic: dt(4), limit: 2 });
    expect(answers(historical)).toEqual(answers(await ref.search(def.name, query, { limit: 2 })));
    expect((await c.at(dt(4)).search(def.name, query, { limit: 2 })).cacheHit).toBe(true);
    expect((await c.at(dt(4)).search(def.name, query, { ids: [2], limit: 1 })).hits[0]!.id).toBe(2);
  }
});
it('roundtrips full backups, provenance across forks, schema history, typed tombstones and latest-only exports', async () => {
  const { db, c } = await fixture();
  await c.at(dt(-1)).put({ id: 1n, amount: 2 });
  await c.createIndex({ name: 'idx', fields: ['amount'], order: ['asc'] });
  const rev = (await db.stats()).revision;
  await c.at(dt(1)).put({ id: 1n, amount: 5 });
  await c.at(dt(3)).delete(1n);
  const fresh = await memory();
  await fresh.import(await db.export({ history: 'full' }));
  const f = fresh.collection<Price>('prices');
  expect(await f.has(1n)).toBe(false);
  expect((await f.at(dt(2)).get(1n))?.amount).toBe(5);
  const source = { storeId: db.storeId, revision: rev };
  expect((await f.at(dt(2), { $asOfRevision: source }).get(1n))?.amount).toBe(2);
  await f.at(dt(0)).put({ id: 1n, amount: 9 });
  const fork = { storeId: fresh.storeId, revision: (await fresh.stats()).revision };
  const next = await memory();
  await next.import(fresh.exportStream({ history: 'full' }));
  const n = next.collection<Price>('prices');
  expect((await n.at(dt(0), { $asOfRevision: source }).get(1n))?.amount).toBe(2);
  expect((await n.at(dt(0), { $asOfRevision: fork }).get(1n))?.amount).toBe(9);
  expect((await n.audit(1n)).map((e) => e.recorded.storeId)).toEqual([
    fresh.storeId,
    db.storeId,
    db.storeId,
    db.storeId,
  ]);
  await expect(
    fresh.import(await db.export({ history: 'full' }), { mode: 'merge' }),
  ).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  const receiver = await memory();
  await receiver.import(await db.export());
  await expect(receiver.collection('prices').at(dt(1)).get(1n)).rejects.toMatchObject({
    code: 'HISTORY_NOT_ENABLED',
  });
  await expect(db.export({ history: 'full', maxHistoryRecords: 1 })).rejects.toThrow();
  const rejected = await memory();
  await expect(
    rejected.import(await db.export({ history: 'full' }), { maxHistoryRecords: 1 }),
  ).rejects.toThrow();
  expect(await rejected.collections()).toEqual([]);
  await fresh.verify();
  await next.verify();
});
it('matches an independent cell oracle after randomized overlapping edits and recorded cutoffs', async () => {
  const { db, c } = await fixture();
  const facts = new Map<number, number | null>();
  const snapshots: { revision: number; values: (number | null)[] }[] = [];
  let seed = 271828;
  const random = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  const visible = (t: number) => {
    let winning = -1,
      v: number | null = null;
    for (const [k, val] of facts)
      if (k <= t && k > winning) {
        winning = k;
        v = val;
      }
    return v;
  };
  for (let op = 0; op < 48; op++) {
    const start = random(20),
      next = Math.min(...[...facts.keys()].filter((x) => x > start), 22),
      old = visible(start);
    const until = random(3) === 0 ? start + 1 + random(next - start) : undefined;
    const value = random(4) === 0 ? null : op;
    const v = c.at(dt(start), until === undefined ? {} : { $until: dt(until) });
    if (value === null) expect(await v.delete('id')).toBe(old !== null);
    else await v.put({ id: 'id', amount: value });
    if (value !== null || old !== null) {
      facts.set(start, value);
      if (until !== undefined && !facts.has(until)) facts.set(until, old);
    }
    snapshots.push({
      revision: (await db.stats()).revision,
      values: Array.from({ length: 24 }, (_, t) => visible(t)),
    });
    const chosen = snapshots[random(snapshots.length)]!;
    for (let t = 0; t < 24; t++) {
      expect(
        (await c.at(dt(t), { $asOfRevision: chosen.revision }).get('id'))?.amount ?? null,
      ).toBe(chosen.values[t]);
    }
  }
  await db.verify();
});
it('detects physical index damage and reports collection, cutoff and snapshot errors explicitly', async () => {
  const backend = createMemoryBackend(),
    db = await openDatabase(backend);
  opened.push(db);
  const c = await db.ensureCollection('test', { $trackHistory: true });
  await c.at(dt(0)).put({ id: 1 });
  expect(await c.history(1, { limit: 0 })).toEqual([]);
  await expect(
    c.at(dt(0), { $asOfRevision: { storeId: crypto.randomUUID(), revision: 1 } }).get(1),
  ).rejects.toMatchObject({ code: 'HISTORY_UNAVAILABLE' });
  const raw = await openDbsonl(backend, 'default');
  await raw.transaction(async (tx) => {
    for await (const r of tx.scan({ gte: 'b:', lt: 'b;' })) {
      tx.delete(r.key);
      break;
    }
  });
  await expect(db.verify()).rejects.toMatchObject({ code: 'CORRUPT' });
  await raw.close();
});
it('falls back to a batched baseline under tight transaction limits; discarded data has unknown prehistory', async () => {
  const db = await openMemory({ maxTransactionOperations: 20 });
  opened.push(db);
  const c = db.collection<Price>('old');
  for (let i = 0; i < 13; i++) await c.put({ id: i, amount: i });
  await db.ensureCollection('old', { $trackHistory: true });
  // the baseline's commit; the collection's first `_collections` entry is the commit after it
  const publication = (await db.stats()).revision - 1;
  expect(await c.count()).toBe(13);
  for (const id of [0, 6, 12]) {
    const entry = (await c.audit(id))[0]!;
    expect(entry.kind).toBe('seed');
    expect(entry.revision).toBe(publication);
    expect(entry.recorded.revision).toBe(publication);
    await expect(
      c.at(entry.from, { $asOfRevision: publication - 1 }).get(id),
    ).rejects.toMatchObject({ code: 'HISTORY_UNAVAILABLE' });
  }
  await db.verify();
  const other = db.collection('discarded');
  await other.put({ id: 1 });
  await other.delete(1);
  await db.ensureCollection('discarded', { $trackHistory: true });
  await expect(other.at(dt(-1)).get(1)).rejects.toMatchObject({ code: 'HISTORY_UNAVAILABLE' });
});
it('resumes a durable partially seeded baseline with complete publication and a live writer fence', async () => {
  const { activateBatches } = await import('../src/history-activation.js');
  const backend = createMemoryBackend(),
    db = await openDatabase(backend);
  opened.push(db);
  const c = db.collection<Price>('existing');
  await c.insertMany(Array.from({ length: 9 }, (_, id) => ({ id, amount: id })));
  const raw = await openDbsonl(backend, 'default');
  let commits = 0;
  const aborter = new AbortController();
  const interrupted = new Proxy(raw, {
    get(target, k) {
      if (k === 'transaction')
        return async (...args: Parameters<typeof raw.transaction>) => {
          const result = await raw.transaction(...args);
          if (++commits === 2) aborter.abort(Error('simulated stop'));
          return result;
        };
      return Reflect.get(target, k, target);
    },
  });
  await expect(
    activateBatches(
      interrupted,
      'existing',
      { maxRecordBytes: 1e6, maxTransactionBytes: 1e7, maxTransactionOperations: 100 },
      2,
      aborter.signal,
    ),
  ).rejects.toThrow('simulated stop');
  expect(await c.count()).toBe(9);
  await expect(c.put({ id: 0, amount: 40 })).rejects.toMatchObject({ code: 'HISTORY_ACTIVATING' });
  await expect(c.at(dt(1)).get(1)).rejects.toMatchObject({ code: 'HISTORY_ACTIVATING' });
  await expect(db.export({ history: 'full' })).rejects.toMatchObject({
    code: 'HISTORY_ACTIVATING',
  });
  expect((await db.export()).length).toBeGreaterThan(0);
  await raw.close();
  const resumed = await openDatabase(backend);
  opened.push(resumed);
  await resumed.ensureCollection('existing', { $trackHistory: true });
  const first = (await c.audit(1))[0]!;
  expect(await c.at(first.from).count()).toBe(9);
  const target = await memory();
  await target.import(await db.export({ history: 'full' }));
  expect((await target.collection('existing').audit(1))[0]!.recorded).toEqual(first.recorded);
  await resumed.verify();
  await target.verify();
});
it('assigns actual commit receipts after concurrent unrelated writes and rolls back competing tracked edits', async () => {
  const backend = createMemoryBackend(),
    db = await openDatabase(backend),
    peer = await openDatabase(backend);
  opened.push(db, peer);
  const c = await db.ensureCollection<Price>('prices', { $trackHistory: true });
  const base = (await db.stats()).revision;
  let ready!: () => void, release!: () => void;
  const started = new Promise<void>((r) => {
      ready = r;
    }),
    go = new Promise<void>((r) => {
      release = r;
    });
  const update = db.transaction(async (tx) => {
    await tx.collection<Price>('prices').put({ id: 1, amount: 7 });
    ready();
    await go;
  });
  await started;
  await peer.collection('other').put({ id: 9 });
  release();
  const receipt = await update;
  expect(receipt.revision).toBe(base + 2);
  const audit = await c.audit(1);
  expect(audit[0]!.recorded.revision).toBe(receipt.revision);
  expect(await c.at(audit[0]!.from, { $asOfRevision: base + 1 }).has(1)).toBe(false);
  let ready2!: () => void, release2!: () => void;
  const begin = new Promise<void>((r) => {
      ready2 = r;
    }),
    end = new Promise<void>((r) => {
      release2 = r;
    });
  const losing = db.transaction(async (tx) => {
    await tx.collection<Price>('prices').update(1, { amount: 8 });
    await tx.collection('other').put({ id: 7 });
    ready2();
    await end;
  });
  await begin;
  await peer.collection<Price>('prices').update(1, { amount: 20 });
  release2();
  await expect(losing).rejects.toMatchObject({ code: 'CONFLICT' });
  expect((await c.get(1))!.amount).toBe(20);
  expect(await db.collection('other').has(7)).toBe(false);
  expect(await c.audit(1)).toHaveLength(2);
});
it('binds a multi-collection transaction to one date and preserves one commit cutoff', async () => {
  const { db, c } = await fixture();
  await db.ensureCollection('related', { $trackHistory: true });
  const result = await db.transaction(
    async (tx) => {
      await tx.collection<Price>('prices').put({ id: 'x', amount: 1 });
      await tx.collection('related').put({ id: 1 });
      expect((await tx.collection<Price>('prices').get('x'))?.amount).toBe(1);
    },
    { $historic: dt(-20) },
  );
  expect((await c.audit('x'))[0]!.recorded.revision).toBe(result.revision);
  expect(await db.collection('related').has(1, { $historic: dt(-20) })).toBe(true);
  await db.transaction(
    async (tx) => {
      expect(await tx.collection('related').has(1)).toBe(false);
    },
    { $historic: dt(-21), $asOfRevision: result.revision },
  );
  const early = c.at(dt(-20), { $asOfRevision: result.revision });
  await c.at(dt(0)).put({ id: 'x', amount: 3 });
  await expect(early.audit('x', { $asOfRevision: (await db.stats()).revision })).rejects.toThrow();
});
it('resolves an ordinary historical point with one bounded fact seek, independent of timeline depth', async () => {
  const backend = createMemoryBackend(),
    db = await openDatabase(backend);
  opened.push(db);
  await db.ensureCollection('deep', { $trackHistory: true });
  await db.transaction(async (tx) => {
    for (let t = 0; t < 256; t++)
      await tx.collection<Price>('deep').at(dt(t)).put({ id: 1, amount: t });
  });
  const { point } = await import('../src/history-store.js');
  const raw = await openDbsonl(backend, 'default'),
    reader = await raw.beginRead();
  let rows = 0,
    gets = 0,
    scans = 0;
  try {
    const instrumented = {
      revision: reader.revision,
      get: (key: string) => {
        gets++;
        return reader.get(key);
      },
      async *scan(options?: Parameters<typeof reader.scan>[0]) {
        scans++;
        expect(options?.limit).toBe(1);
        for await (const row of reader.scan(options)) {
          rows++;
          yield row;
        }
      },
    };
    for (const t of [0, 127, 255])
      expect((await point(instrumented, 'deep', 'n1', t)).value).toEqual({ id: 1, amount: t });
    expect([scans, rows, gets]).toEqual([3, 3, 0]);
  } finally {
    await reader.close();
    await raw.close();
  }
});
it('reuses immutable historical results after unrelated commits and invalidates a purely past correction', async () => {
  const { db, c } = await fixture();
  await c.at(dt(-8640000000000000)).put({ id: 1, amount: 2 });
  await c.at(dt(7)).put({ id: 1, amount: 8 });
  const v = c.at(dt(-1)),
    p = v.prepareFind(),
    opts = { cache: true } as const;
  await p.evaluate(undefined, opts);
  await p.evaluate(undefined, opts);
  const hits = db.queryCacheStats()!.hits;
  await db.collection('separate').put({ id: 7 });
  const hit = await p.evaluate(undefined, opts);
  expect(hit.rows[0]!.amount).toBe(2);
  expect(db.queryCacheStats()!.hits).toBeGreaterThan(hits);
  expect(hit.summary.revision).toBe((await db.stats()).revision);
  await c.at(dt(-3)).update(1, { amount: 9 });
  expect((await p.evaluate(undefined, opts)).rows[0]!.amount).toBe(9);
  expect((await c.at(dt(8640000000000000)).get(1))?.amount).toBe(8);
  await db.verify();
});
it('merges latest-only archives through the target timeline and its temporal constraints', async () => {
  const { db, c } = await fixture();
  await c.createIndex({ name: 'value', fields: ['amount'], temporalUnique: true });
  await c.at(dt(3)).put({ id: 'a', amount: 4 });
  const exported = await db.export();
  const peer = await memory(),
    dest = await peer.ensureCollection<Price>('prices', { $trackHistory: true });
  await dest.createIndex({ name: 'value', fields: ['amount'], temporalUnique: true });
  await peer.import(exported, { mode: 'merge' });
  expect((await dest.audit('a'))[0]!.kind).toBe('put');
  expect((await dest.get('a'))?.amount).toBe(4);
  expect((await dest.indexes())[0]?.temporalUnique).toBe(true);
  await peer.verify();
});

it('captures a stream date and recorded receipt before its first pull', async () => {
  const { db, c } = await fixture();
  const first = await db.transaction((tx) =>
    tx.collection<Price>('prices').at(dt(10)).put({ id: 1, amount: 100 }),
  );
  await c.at(dt(20)).put({ id: 1, amount: 200 });
  const date = dt(15);
  const cutoff = { storeId: db.storeId, revision: first.revision };
  const direct = c.stream({}, { $historic: date });
  const prepared = c.prepareFind().stream(undefined, { $historic: date, $asOfRevision: cutoff });
  date.setTime(25);
  cutoff.revision = 0;
  for (const stream of [direct, prepared]) {
    const amounts: number[] = [];
    for await (const event of stream)
      if (event.type === 'batch') amounts.push(...event.rows.map((row) => row.amount));
    expect(amounts).toEqual([100]);
  }
});

it('captures the time range once while committing pull-driven input batches', async () => {
  const { c } = await fixture();
  const from = dt(10),
    end = dt(20);
  const input = [[{ id: 1, amount: 10 }], [{ id: 2, amount: 20 }]];
  const batches = c.insertBatches(input, { $historic: from, $until: end });
  from.setTime(30);
  end.setTime(40);
  expect(await c.at(dt(15)).has(1)).toBe(false);
  expect((await batches.next()).value).toMatchObject({ ids: [1] });
  from.setTime(50);
  end.setTime(60);
  expect((await batches.next()).value).toMatchObject({ ids: [2] });
  expect((await batches.next()).done).toBe(true);
  expect((await c.at(dt(15)).getMany([1, 2])).map((row) => row?.amount)).toEqual([10, 20]);
  expect(await c.at(dt(20)).getMany([1, 2])).toEqual([undefined, undefined]);
  expect(await c.getMany([1, 2])).toEqual([undefined, undefined]);
});

it('seeks the prior assertion once when deleting part of a restored interval', async () => {
  const backend = createMemoryBackend();
  const db = await openDatabase(backend);
  opened.push(db);
  const c = await db.ensureCollection<Price>('prices', { $trackHistory: true });
  await c.at(dt(0)).put({ id: 1, amount: 5 });
  await c.at(dt(20)).put({ id: 1, amount: 8 });
  await c.at(dt(4), { $until: dt(7) }).update(1, { amount: 6 });
  const { assertChange } = await import('../src/history-store.js');
  const { readSchema } = await import('../src/keys.js');
  const raw = await openDbsonl(backend, 'default');
  let factSeeks = 0;
  let imageReads = 0;
  try {
    await raw.transaction(async (tx) => {
      const schema = readSchema((await tx.get('s:prices')).value);
      const writer: typeof tx = {
        revision: tx.revision,
        put: (key, value) => tx.put(key, value),
        delete: (key) => tx.delete(key),
        get: (key) => {
          if (key.startsWith('a:prices:')) imageReads++;
          return tx.get(key);
        },
        scan: (options) => {
          if (options?.gte?.startsWith('a:prices:')) factSeeks++;
          return tx.scan(options);
        },
      };
      expect(
        await assertChange(writer, 'prices', 'n1', schema, null, { time: 9, until: 12 }),
      ).toEqual({ applied: true, live: false });
    });
  } finally {
    await raw.close();
  }
  expect({ factSeeks, imageReads }).toEqual({ factSeeks: 1, imageReads: 1 });
  expect(await c.at(dt(10)).has(1)).toBe(false);
  expect((await c.at(dt(12)).get(1))!.amount).toBe(5);
  expect((await c.get(1))!.amount).toBe(8);
  await db.verify();
});

it('keeps the temporal posting cache empty with a zero byte budget, including empty indexes', async () => {
  const db = await openMemory({ queryCache: { maxTemporalIndexBytes: 0 } });
  opened.push(db);
  const c = await db.ensureCollection<Price>('prices', { $trackHistory: true });
  await c.at(dt(10)).put({ id: 1, amount: 2 });
  await c.createIndex({ name: 'amount', fields: ['amount'], order: ['asc'] });
  expect((await c.at(dt(3)).pageIdsByIndex('amount')).rows).toEqual([]);
  expect(db.queryCacheStats()).toMatchObject({ temporalIndexes: 0, temporalIndexBytes: 0 });
});
it('answers over past versions that an index created later cannot key as a scan does, and refuses explicit pages of that index', async () => {
  const db = await memory(),
    c = await db.ensureCollection<{ id: number; tags: unknown }>('tagged', { $trackHistory: true });
  await c.at(dt(1)).insertMany([
    { id: 1, tags: ['a', 'b'] },
    { id: 2, tags: 'a' },
    { id: 3, tags: 'c' },
  ]);
  await c.at(dt(8)).update(1, { tags: 'b' });
  // Indexes check the documents they are built on: today's versions, not the past array.
  await c.createIndex({ name: 'byTags', fields: ['tags'] });
  await c.createIndex({ name: 'tagsInOrder', fields: ['tags'], order: ['asc'] });
  const past = c.at(dt(4));
  const requests = [
    { filters: [{ field: 'tags', op: 'eq' as const, value: 'a' }] },
    { filters: [{ field: 'tags', op: 'eq' as const, value: ['a', 'b'] }] },
    { filters: [{ field: 'tags', op: 'gte' as const, value: 'b' }] },
    { sorters: [{ field: 'tags', direction: 'desc' as const }] },
    { filters: [{ field: 'tags', op: 'gt' as const, value: 'a' }], sorters: [{ field: 'tags', direction: 'asc' as const }] },
  ];
  for (const request of requests) {
    const scanned = await past.find({ ...request, access: 'scan' });
    expect(await past.find(request), JSON.stringify(request)).toEqual(scanned);
    expect(await past.count({ filters: request.filters ?? [] })).toBe(
      (await past.find({ filters: request.filters ?? [], access: 'scan' })).length,
    );
    // The ordered index would leave the array out of ranges and sorts; the equality index stays exact.
    expect(['ordered', 'range']).not.toContain((await past.explain(request)).access.kind);
  }
  expect((await past.explain(requests[0]!)).access.kind).toBe('equality');
  expect((await past.find(requests[0]!)).map((d) => d.id)).toEqual([2]);
  expect((await past.find(requests[3]!)).map((d) => d.id)).toEqual([1, 3, 2]);
  // An index that names it explicitly would leave the past array out, so it says so instead.
  await expect(past.pageByIndex('tagsInOrder', { limit: 10 })).rejects.toMatchObject({
    code: 'INVALID_INDEX_VALUE',
  });
  await expect(past.countByIndex('tagsInOrder')).rejects.toMatchObject({ code: 'INVALID_INDEX_VALUE' });
  // Where every visible version is keyable, the index answers as before.
  const later = c.at(dt(9));
  expect((await later.explain(requests[0]!)).access.kind).toBe('ordered');
  expect((await later.explain(requests[2]!)).access.kind).toBe('range');
  expect((await later.find(requests[0]!)).map((d) => d.id)).toEqual([2]);
  expect((await later.pageByIndex('tagsInOrder', { limit: 10 })).rows.map((d) => d.id)).toEqual([2, 1, 3]);
  expect((await c.explain(requests[2]!)).access.kind).toBe('range');
  await db.verify();
});
it('leaves an equality index to a scan where a past key would exceed the key limit', async () => {
  type Row = { id: string; a: string; b: string; c: string; d: string };
  const db = await memory(),
    c = await db.ensureCollection<Row>('long', { $trackHistory: true });
  // The 4096-unit key limit counts the document's ID: these values fit as an operand, but not with this ID.
  const id = 'k'.repeat(450),
    [a, b, d] = ['a', 'b', 'd'].map((x) => x.repeat(1024)) as [string, string, string],
    long = 'c'.repeat(600);
  await c.at(dt(1)).insert({ id, a, b, c: long, d });
  await c.at(dt(8)).update(id, { c: 'short' });
  await c.createIndex({ name: 'byAll', fields: ['a', 'b', 'c', 'd'] });
  const eq = (value: string) => ({
    filters: (['a', 'b', 'c', 'd'] as const).map((field) => ({
      field,
      op: 'eq' as const,
      value: field === 'c' ? value : { a, b, d }[field],
    })),
  });
  const past = c.at(dt(4));
  expect((await past.find(eq(long))).map((r) => r.id)).toEqual([id]);
  expect((await past.explain(eq(long))).access.kind).toBe('scan');
  expect((await c.explain(eq('short'))).access.kind).toBe('equality');
  expect((await c.find(eq('short'))).map((r) => r.id)).toEqual([id]);
});
