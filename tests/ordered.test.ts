import { afterEach, expect, it } from 'vitest';
import { openDbsonl, DEFAULT_OPTIONS } from 'defuss-dbsonl';
import { compareValues } from 'defuss-dataview/query';
import {
  openDatabase,
  createMemoryBackend,
  openMemory,
  Database,
  type OrderedValue,
} from '../src/index.js';
import { orderBody, orderComponent } from '../src/ordered-key.js';
import type { IndexDirection } from '../src/types.js';

const handles: Database[] = [];
async function opened(backend = createMemoryBackend()) {
  const db = await openDatabase(backend);
  handles.push(db);
  return db;
}
afterEach(async () => {
  for (const db of handles.splice(0)) await db.close();
});
const ids = (rows: { id: unknown }[]) => rows.map((row) => row.id);
const feed = { name: 'feed', fields: ['tenant', 'info.time'], order: ['asc', 'desc'] as const };
async function sample() {
  const db = await opened(),
    c = db.collection<any>('events');
  await c.insertMany(
    Array.from({ length: 600 }, (_, id) => ({
      id,
      tenant: 't' + (id % 3),
      info: { time: new Date(id % 97) },
      amount: id,
    })),
  );
  await c.createIndex(feed);
  return { db, c };
}

it('matches the upstream total order in both directions, including ties and variable-length values', () => {
  const values: OrderedValue[] = [
    undefined,
    null,
    NaN,
    new Date(NaN),
    false,
    true,
    -Infinity,
    -Number.MAX_VALUE,
    -2,
    -1,
    -Number.MIN_VALUE,
    -0,
    0,
    Number.MIN_VALUE,
    0.1,
    2,
    Number.MAX_VALUE,
    Infinity,
    -(1n << 1024n),
    -256n,
    -255n,
    -16n,
    -15n,
    -1n,
    0n,
    1n,
    15n,
    16n,
    255n,
    256n,
    1n << 1024n,
    '',
    '\0',
    'a',
    'a\0',
    'aa',
    'a\uffff',
    'ab',
    'ä',
    '\ud800',
    '\ud800\udc00',
    '\uffff',
    new Date(-8640000000000000),
    new Date(-1),
    new Date(0),
    new Date(1),
    new Date(8640000000000000),
    new ArrayBuffer(0),
    new Uint8Array([0]),
    new Uint8Array([0, 0]),
    new Uint8Array([0, 255]),
    new Uint8Array([1]),
    new DataView(new Uint8Array([8, 1, 9]).buffer, 1, 1),
  ];
  for (const direction of ['asc', 'desc'] as const) {
    const encoded = values.map((value) => orderComponent(orderBody(value), direction));
    for (const [i, a] of values.entries())
      for (const [j, b] of values.entries()) {
        const cmp = encoded[i]! < encoded[j]! ? -1 : Number(encoded[i]! > encoded[j]!);
        expect(cmp === Math.sign(compareValues(a, b)) * (direction === 'asc' ? 1 : -1)).toBe(true);
      }
  }
});

it('plans mixed-direction compound ranges and streams rows and projections in upstream stable order', async () => {
  const { c } = await sample();
  const request = {
    filters: [
      { field: 'tenant', op: 'eq' as const, value: 't1' },
      { field: 'info.time', op: 'gt' as const, value: new Date(10) },
      { field: 'info.time', op: 'lte' as const, value: new Date(80) },
    ],
    sorters: [{ field: 'info.time', direction: 'desc' as const }],
    limit: 7,
  };
  expect((await c.explain(request)).access).toEqual({
    kind: 'ordered',
    index: 'feed',
    equalityPrefix: 1,
    rangeField: 'info.time',
  });
  const scan = await c.query({ ...request, access: 'scan' }, { cache: false });
  const fast = await c.query(request, { cache: false, batchSize: 3, maxScannedRows: 8 });
  expect(fast.rows).toEqual(scan.rows);
  expect(fast.summary).toMatchObject({ strategy: 'ordered', scannedRows: 8 });
  const exact = await c.query(request, { count: 'exact', cache: false });
  expect(exact.summary.totalResultRows).toBe(
    (await c.find({ ...request, access: 'scan', limit: undefined })).length,
  );
  const streamed: any[] = [];
  for await (const event of c.stream(request, { batchSize: 2 }))
    if (event.type === 'batch') streamed.push(...event.rows);
  expect(streamed).toEqual(scan.rows);
  const projected = await c.select(
    {
      filters: request.filters,
      select: { n: c.q.field('id') },
      orderBy: [{ expr: c.q.path('info.time'), direction: 'desc' }],
    },
    { limit: 7 },
    { cache: false, maxScannedRows: 8 },
  );
  expect(projected.rows.map((r) => r.n)).toEqual(ids(scan.rows));
  expect(projected.summary.strategy).toBe('ordered');
  // Omitting a varying suffix would change sort stability for ties. Locale collation also needs its own sort.
  for (const other of [
    { sorters: [{ field: 'tenant' }] },
    { ...request, semantics: { strings: 'locale' as const } },
    { filters: request.filters },
  ])
    expect((await c.explain(other)).access.kind).toBe('scan');
});

it('preserves every compound tie and bound across cursor pages, updates, deletes, rollback and DDL', async () => {
  const { c, db } = await sample();
  const options = { prefix: ['t2'], gte: new Date(10), lt: new Date(80), limit: 7 };
  const expected = await c.find({
    filters: [
      { field: 'tenant', op: 'eq', value: 't2' },
      { field: 'info.time', op: 'gte', value: options.gte },
      { field: 'info.time', op: 'lt', value: options.lt },
    ],
    sorters: [{ field: 'info.time', direction: 'desc' }],
    access: 'scan',
  });
  const result: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await c.pageByIndex('feed', { ...options, after: cursor });
    result.push(...page.rows);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(ids(result)).toEqual(ids(expected));
  const first = await c.pageByIndex('feed', options),
    after = first.nextCursor!;
  const snap = await db.snapshot();
  try {
    await db.collection('other').put({ id: 1 });
    expect(ids((await c.pageByIndex('feed', { ...options, after })).rows)).toEqual(
      ids(expected.slice(7, 14)),
    );
    await expect(
      c.pageByIndex('feed', { ...options, prefix: ['t1'], after }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    await expect(c.pageByIndex('feed', { ...options, after: 'nonsense' })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
    const other = await opened();
    await expect(
      other.collection('events').pageByIndex('feed', { ...options, after }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    await expect(
      db.transaction(async (tx) => {
        await tx.collection('events').delete(expected[0].id);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect((await c.pageByIndex('feed', { ...options, after })).rows.length).toBe(7);
    await c.update(expected[0].id, { tenant: 'moved' });
    await expect(c.pageByIndex('feed', { ...options, after })).rejects.toMatchObject({
      code: 'STALE_CURSOR',
    });
    await c.dropIndex('feed');
    await db.compact();
    await db.collect();
    expect(
      ids((await snap.collection('events').pageByIndex('feed', { ...options, after })).rows),
    ).toEqual(ids(expected.slice(7, 14)));
    await expect(c.pageByIndex('feed')).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  } finally {
    await snap.close();
  }
  expect((await db.verify()).indexEntries).toBe(0);
});

it('supports positional bounds on ascending and descending mixed-type keys, primary ID prefixes and empty intervals', async () => {
  const db = await opened(),
    c = db.collection<any>('records');
  const vals = [
    null,
    undefined,
    NaN,
    new Date(NaN),
    -1,
    -0,
    0,
    2n,
    '',
    'a',
    'a\0',
    'ab',
    'abc',
    new Date(10),
    new Uint8Array([0, 1]),
  ];
  await c.insertMany(vals.map((k, i) => ({ id: i === 0 ? 'x' : i, k })));
  await c.insertMany([
    { id: 100, k: 'a' },
    { id: 1000, k: 'a' },
    { id: 't', k: 'a' },
    { id: 'ta', k: 'a' },
  ]);
  for (const order of ['asc', 'desc'] as const) {
    await c.createIndex({ name: order, fields: ['k'], order: [order] });
    for (const opts of [
      {},
      { gte: 'a', lte: 'ab' },
      { gt: 'a', lt: 'abc' },
      { gt: 2n, lt: -1 },
      { gte: null },
      { lte: undefined },
      { prefix: ['a'] },
    ]) {
      const expected = (
        await c.find({ sorters: [{ field: 'k', direction: order }], access: 'scan' })
      ).filter(
        (r) =>
          (!Object.hasOwn(opts, 'gte') || compareValues(r.k, opts.gte) >= 0) &&
          (!Object.hasOwn(opts, 'lte') || compareValues(r.k, opts.lte) <= 0) &&
          (!Object.hasOwn(opts, 'gt') || compareValues(r.k, opts.gt) > 0) &&
          (!Object.hasOwn(opts, 'lt') || compareValues(r.k, opts.lt) < 0) &&
          (!opts.prefix || compareValues(r.k, opts.prefix[0]) === 0),
      );
      const all: any[] = [];
      let after: string | undefined;
      do {
        const page = await c.pageByIndex(order, { ...opts, limit: 1, after });
        all.push(...page.rows);
        after = page.nextCursor ?? undefined;
      } while (after);
      expect(ids(all)).toEqual(ids(expected));
    }
  }
  for (const opts of [
    { limit: 0 },
    { limit: 1001 },
    { gt: 1, gte: 2 },
    { prefix: [1], lt: 2 },
    { maxOutputBytes: 1 },
    { signal: AbortSignal.abort() },
  ])
    await expect(c.pageByIndex('asc', opts)).rejects.toThrow();
  for (const bad of [
    { order: ['asc', 'desc'] },
    { order: ['up'] },
    { order: ['asc'], unique: true },
  ])
    expect(() =>
      c.createIndex({ name: 'bad', fields: ['k'], ...bad, order: bad.order as IndexDirection[] }),
    ).toThrow();
  await expect(c.put({ id: 99, k: { invalid: 1 } })).rejects.toMatchObject({
    code: 'INVALID_INDEX_VALUE',
  });
  await expect(c.put({ id: 99, k: 'x'.repeat(2000) })).rejects.toThrow();
  expect(await c.has(99)).toBe(false);
});

it('uses durable collection revisions across handles and reports the current snapshot revision on cache hits', async () => {
  const backend = createMemoryBackend(),
    a = await opened(backend),
    b = await opened(backend);
  const c = a.collection<any>('rows');
  await c.insertMany(Array.from({ length: 150 }, (_, id) => ({ id, n: id })));
  const report = c.prepareAggregate({ measures: { total: c.q.sum(c.q.field('n')) } });
  const before = await report.evaluate(undefined, { cache: 'refresh' }),
    old = await a.snapshot();
  try {
    for (let i = 0; i < 3; i++) {
      await b.collection('audit').put({ id: i });
      const hit = await report.evaluate();
      expect(hit.rows).toEqual(before.rows);
      expect(hit.summary.revision).toBe((await b.stats()).revision);
    }
    expect(a.queryCacheStats()).toMatchObject({ hits: 3, crossRevisionHits: 3 });
    await b.collection<any>('rows').put({ id: 150, n: 11 });
    expect((await report.evaluate()).rows[0]!.total).toBe(before.rows[0]!.total! + 11);
    const pinned = await old
      .collection<any>('rows')
      .aggregate({ measures: { total: c.q.sum(c.q.field('n')) } });
    expect(pinned.rows).toEqual(before.rows);
    expect(pinned.summary.revision).toBe(old.revision);
    await report.evaluate(undefined, { cache: 'refresh' });
    await b.collection('rows').createIndex({ name: 'idx', fields: ['n'] });
    const n = a.queryCacheStats()!.invalidations;
    await report.evaluate();
    expect(a.queryCacheStats()!.invalidations).toBe(n + 1);
  } finally {
    await old.close();
  }
});

it('uses bounded primary-key IN reads and maintains typed IDs and natural source order', async () => {
  const db = await opened(),
    c = db.collection<any>('ids');
  await c.insertMany([
    { id: 1, k: 'x' },
    { id: '1', k: 'x' },
    { id: 1n, k: 'x' },
    { id: 10, k: 'x' },
    { id: 'q', k: 'x' },
  ]);
  const members: any[] = ['q', 10, '1', 1, 1n, 1, undefined, {}, 'absent'];
  const filter = { filters: [{ field: 'id', op: 'in' as const, value: members }] };
  const prepared = c.prepareFind(filter);
  members[0] = 'other';
  expect(ids((await prepared.evaluate()).rows)).toEqual([1n, 1, 10, '1', 'q']);
  expect((await c.explain(filter)).access).toEqual({ kind: 'primary-in', pointKeys: 6 });
  expect(await c.find(filter)).toEqual(await c.find({ ...filter, access: 'scan' }));
  expect(
    (
      await c.explain({
        filters: [{ field: 'id', op: 'in', value: Array.from({ length: 257 }, (_, i) => i) }],
      })
    ).access.kind,
  ).toBe('scan');
  expect(await c.find({ filters: [{ field: 'id', op: 'in', value: [] }] })).toEqual([]);
});

it('preserves pre-top-k search scores while reading indexed candidates or explicit IDs', async () => {
  const db = await opened(),
    c = db.collection<any>('posts');
  await c.insertMany(
    Array.from({ length: 360 }, (_, id) => ({
      id,
      g: id % 60,
      text: 'database systems ' + id,
      vector: new Float32Array([1, (id % 7) + 1]),
    })),
  );
  await c.createIndex({ name: 'g', fields: ['g'] });
  await c.createSearchIndex({
    name: 'hy',
    kind: 'hybrid',
    text: { fields: { text: { path: 'text' } } },
    vector: { path: 'vector', dimensions: 2 },
  });
  const query = { text: 'systems', vector: [1, 2] },
    filter = { filters: [{ field: 'g', op: 'eq' as const, value: 7 }] };
  const scan = await c.search('hy', query, { filter: { ...filter, access: 'scan' } });
  const indexed = await c.search('hy', query, { filter });
  expect(indexed.hits).toEqual(scan.hits);
  expect([indexed.filterScannedRows, scan.filterScannedRows]).toEqual([6, 360]);
  const ids = [7, 8, 67];
  const narrowed = await c.search('hy', query, { filter, ids });
  expect(narrowed.filterScannedRows).toBe(3);
  expect(narrowed.hits).toEqual(
    (await c.search('hy', query, { filter: { ...filter, access: 'scan' }, ids })).hits,
  );
});

it('binds transaction continuations to their overlay and rolls all derived ordered keys back together', async () => {
  const { db, c } = await sample();
  let escaped = '';
  await expect(
    db.transaction(async (scope) => {
      const t = scope.collection<any>('events');
      await t.update(1, { info: { time: new Date(9000) } });
      const first = await t.pageByIndex('feed', { prefix: ['t1'], limit: 1 });
      expect(first.rows[0].info.time.getTime()).toBe(9000);
      escaped = first.nextCursor!;
      expect(
        (await t.pageByIndex('feed', { prefix: ['t1'], after: escaped, limit: 1 })).rows,
      ).toHaveLength(1);
      await t.delete(1);
      await expect(t.pageByIndex('feed', { prefix: ['t1'], after: escaped })).rejects.toMatchObject(
        { code: 'STALE_CURSOR' },
      );
      throw new Error('rollback');
    }),
  ).rejects.toThrow('rollback');
  await expect(c.pageByIndex('feed', { prefix: ['t1'], after: escaped })).rejects.toMatchObject({
    code: 'INVALID_CURSOR',
  });
  expect((await c.get(1)).info.time.getTime()).toBe(1);
  const restored = await openMemory();
  handles.push(restored);
  await restored.import(await db.export());
  expect(await restored.collection('events').indexes()).toEqual(await c.indexes());
  expect((await restored.collection('events').pageByIndex('feed', { limit: 5 })).rows).toEqual(
    (await c.pageByIndex('feed', { limit: 5 })).rows,
  );
  expect((await restored.verify()).indexEntries).toBe(600);
});

it('restores primary-key order for selective unsorted ranges, including encounter-order aggregates', async () => {
  const { c } = await sample();
  const filters = [
    { field: 'tenant', op: 'eq' as const, value: 't2' },
    { field: 'info.time', op: 'gte' as const, value: new Date(60) },
    { field: 'info.time', op: 'lt' as const, value: new Date(65) },
  ];
  const full = await c.find({ filters, access: 'scan' });
  expect(full.length).toBeGreaterThan(0);
  expect((await c.explain({ filters })).access).toMatchObject({
    kind: 'range',
    pointKeys: full.length,
  });
  expect(await c.find({ filters }, { maxScannedRows: full.length })).toEqual(full);
  const group = {
    filters,
    groupBy: { time: c.q.path('info.time') },
    measures: { sum: c.q.sum(c.q.field('amount')) },
  };
  const ordinary = await c.aggregate(group);
  const forced = await c.aggregate({
    ...group,
    filters: [...filters, { field: 'amount', op: 'gte', value: 0 }],
    semantics: { strings: 'locale' },
  });
  expect(ordinary.rows).toEqual(forced.rows);
  // Exact threshold and the first over-budget pointer determine the fallback.
  const db = await opened(),
    rows = db.collection<any>('rows');
  await rows.insertMany(Array.from({ length: 300 }, (_, id) => ({ id, n: id })));
  await rows.createIndex({ name: 'n', fields: ['n'], order: ['asc'] });
  for (const [size, kind] of [
    [128, 'range'],
    [129, 'scan'],
  ] as const) {
    const descriptor = { filters: [{ field: 'n', op: 'lt' as const, value: size }] };
    expect((await rows.explain(descriptor)).access.kind).toBe(kind);
    expect(await rows.find(descriptor)).toEqual(await rows.find({ ...descriptor, access: 'scan' }));
  }
});

it('seeks to the next page and reads exactly one lookahead pointer without hydrating it', async () => {
  const backend = createMemoryBackend();
  const raw = await openDbsonl(backend, 'seek', { create: true });
  const id = crypto.randomUUID();
  const { FORMAT_VERSION } = await import('../src/format.js');
  await raw.put('!defuss-db-format', { format: 'defuss-db', version: FORMAT_VERSION, id });
  const reads = { documents: 0, pointers: 0, from: '' };
  const proxy = new Proxy(raw, {
    get(target, key) {
      if (key === 'beginRead')
        return async () => {
          const reader = await target.beginRead();
          return new Proxy(reader, {
            get(session, property) {
              if (property === 'get')
                return (key: string) => {
                  if (key.startsWith('d:')) reads.documents++;
                  return session.get(key);
                };
              if (property === 'scanBatches')
                return async function* (options: Parameters<typeof reader.scanBatches>[0]) {
                  reads.from = options?.gte ?? '';
                  for await (const batch of session.scanBatches(options)) {
                    reads.pointers += batch.filter((row) => row.key.startsWith('o:')).length;
                    yield batch;
                  }
                };
              const member = Reflect.get(session, property);
              return typeof member === 'function' ? member.bind(session) : member;
            },
          });
        };
      const member = Reflect.get(target, key);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
  const db = new Database(proxy, DEFAULT_OPTIONS);
  handles.push(db);
  const c = db.collection<{ id: number; n: number }>('rows');
  await c.insertMany(Array.from({ length: 600 }, (_, id) => ({ id, n: id })));
  await c.createIndex({ name: 'n', fields: ['n'], order: ['asc'] });
  const start = await c.pageByIndex('n', { limit: 300 });
  const other = await openDatabase(backend, { name: 'seek' });
  handles.push(other);
  expect(
    ids(
      (await other.collection('rows').pageByIndex('n', { after: start.nextCursor!, limit: 1 }))
        .rows,
    ),
  ).toEqual([300]);
  const firstLower = reads.from;
  reads.documents = reads.pointers = 0;
  const next = await c.pageByIndex('n', { after: start.nextCursor!, limit: 7 });
  expect(ids(next.rows)).toEqual([300, 301, 302, 303, 304, 305, 306]);
  expect(reads.documents).toBe(7);
  expect(reads.pointers).toBe(8);
  expect(reads.from > firstLower).toBe(true);
  reads.documents = reads.pointers = 0;
  const onlyIds = await c.pageIdsByIndex('n', { after: start.nextCursor!, limit: 7 });
  expect(onlyIds.rows).toEqual(ids(next.rows));
  expect(onlyIds.nextCursor).toBe(next.nextCursor);
  expect(reads.documents).toBe(0);
  expect(reads.pointers).toBe(8);
  reads.pointers = 0;
  expect(await c.countByIndex('n', { gte: 201, lte: 450 })).toBe(250);
  expect(reads.pointers).toBe(250);
  expect(reads.documents).toBe(0);

  await expect(c.pageByIndex('n', { maxOutputBytes: 1 })).rejects.toThrow('maxOutputBytes');
});

it('resumes after the largest permitted physical key without repeating a row', async () => {
  const db = await opened();
  const c = db.collection<{ id: number; s: string }>('ccc');
  const s = 'x'.repeat(1021);
  await c.createIndex({ name: 'k', fields: ['s'], order: ['asc'] });
  await c.insertMany([
    { id: 1, s },
    { id: 2, s },
  ]);
  const page = await c.pageByIndex('k', { prefix: [s], limit: 1 });
  expect(ids(page.rows)).toEqual([1]);
  const last = await c.pageByIndex('k', { prefix: [s], after: page.nextCursor!, limit: 1 });
  expect(ids(last.rows)).toEqual([2]);
  expect(last.nextCursor).toBeNull();
  await expect(c.insert({ id: 10, s })).rejects.toThrow('4096');
  expect((await db.verify()).documents).toBe(2);
});

it('detects a broken ordered pointer and a missing collection marker', async () => {
  const backend = createMemoryBackend(),
    db = await opened(backend);
  const c = db.collection<{ id: number; n: number }>('rows');
  await c.createIndex({ name: 'n', fields: ['n'], order: ['desc'] });
  await c.put({ id: 1, n: 12 });
  const raw = await openDbsonl(backend, 'default', { create: false });
  try {
    const reader = await raw.beginRead();
    const entries = [];
    try {
      for await (const row of reader.scan({ gte: 'o:rows:', lt: 'o:rows;' })) entries.push(row);
    } finally {
      await reader.close();
    }
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    await raw.put(entry.key, 'n2');
    await expect(c.pageByIndex('n')).rejects.toMatchObject({ code: 'CORRUPT' });
    await expect(db.verify()).rejects.toMatchObject({ code: 'CORRUPT' });
    await raw.put(entry.key, entry.value);
    await db.verify();
    await raw.delete('r:rows');
    await expect(db.verify()).rejects.toMatchObject({ code: 'CORRUPT' });
  } finally {
    await raw.close();
  }
});

it('retains cached results after a skipped import and invalidates them after replacement', async () => {
  const target = await opened(),
    source = await opened();
  const c = target.collection<{ id: number; n: number }>('rows');
  await c.insert({ id: 1, n: 20 });
  await source.collection<{ id: number; n: number }>('rows').insert({ id: 1, n: 50 });
  const bytes = await source.export(),
    q = c.q;
  const p = c.prepareAggregate({ measures: { sum: q.sum(q.field('n')) } });
  expect((await p.evaluate(undefined, { cache: 'refresh' })).rows[0]!.sum).toBe(20);
  const hits = target.queryCacheStats()!.hits;
  await target.import(bytes, { mode: 'merge', conflicts: 'skip' });
  expect((await p.evaluate(undefined, { cache: true })).rows[0]!.sum).toBe(20);
  expect(target.queryCacheStats()!.hits).toBe(hits + 1);
  await target.import(bytes, { mode: 'merge', conflicts: 'replace' });
  expect((await p.evaluate(undefined, { cache: true })).rows[0]!.sum).toBe(50);
  expect(target.queryCacheStats()!.hits).toBe(hits + 1);
});

it('keeps direct and cyclic dotted index paths correct on shallow patches and callback updates', async () => {
  const db = await opened();
  const c = db.collection<any>('cycles');
  const doc = { id: 1, n: 2, at: new Date(4), self: undefined as unknown };
  doc.self = doc;
  await c.insert(doc);
  await c.createIndex({ name: 'loop', fields: ['self.n'], order: ['asc'] });
  await c.createIndex({ name: 'at', fields: ['at'], order: ['desc'] });
  await c.createIndex({ name: 'unique', fields: ['at'], unique: true });
  await c.updateMany({}, { n: 3 });
  expect(ids((await c.pageByIndex('loop', { prefix: [3] })).rows)).toEqual([1]);
  expect((await c.pageByIndex('loop', { prefix: [2] })).rows).toHaveLength(0);
  await c.update(1, (r: typeof doc) => {
    r.at.setTime(9);
    return r;
  });
  expect(ids((await c.pageByIndex('at', { prefix: [new Date(9)] })).rows)).toEqual([1]);
  expect((await c.pageByIndex('at', { prefix: [new Date(4)] })).rows).toHaveLength(0);
  await expect(c.insert({ id: 2, at: new Date(9) })).rejects.toMatchObject({
    code: 'DUPLICATE_KEY',
  });
  expect((await db.verify()).indexEntries).toBe(3);
});
