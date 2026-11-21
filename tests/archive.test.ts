import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { encode } from 'defuss-dson/binary';
import { init, compress } from 'defuss-brotli/compressor';
import { openMemory, type Database, type Document } from '../src/index.js';

const handles: Database[] = [];
async function memory(options: Parameters<typeof openMemory>[0] = {}) {
  const db = await openMemory(options);
  handles.push(db);
  return db;
}
afterEach(async () => {
  for (const db of handles.splice(0)) await db.close();
});
async function fixture() {
  const db = await memory(),
    c = db.collection<any>('a');
  const buffer = new ArrayBuffer(16),
    row: any = {
      id: 'native',
      name: 'Brotli document',
      email: 'a',
      vector: new Float32Array([1, 0]),
      date: new Date(123),
      huge: 2n ** 100n,
      missing: undefined,
      map: new Map([['a', { n: 1 }]]),
      set: new Set([1, 2]),
      regexp: /ab/gi,
      buffer,
      view: new Uint8Array(buffer, 2, 3),
      nan: NaN,
      negativeZero: -0,
    };
  row.self = row;
  row.shared = row.map.get('a');
  await c.insert(row);
  await c.insertMany([
    { id: 1, name: 'one', email: 'b' },
    { id: 1n, name: 'big', email: 'c' },
    { id: '1', name: 'string', email: 'd' },
  ]);
  await c.createIndex({ name: 'email', fields: ['email'], unique: true });
  await c.createSearchIndex({
    name: 'search',
    kind: 'hybrid',
    text: { fields: { name: { path: 'name' } } },
    vector: { path: 'vector', dimensions: 2 },
  });
  await db.collection('a0').insert({ id: 1 });
  await db.collection('empty').createIndex({ name: 'x', fields: ['x'] });
  return db;
}
it('round-trips native DSON graphs, typed IDs, empty collections and rebuilt equality/hybrid indexes', async () => {
  const source = await fixture(),
    bytes = await source.export({ blockBytes: 1024 }),
    target = await memory();
  const result = await target.import(bytes);
  expect(result).toMatchObject({
    imported: 5,
    skipped: 0,
    collections: 3,
    sourceRevision: (await source.stats()).revision,
  });
  expect(await target.collections()).toEqual(['a', 'a0', 'empty']);
  const c = target.collection<any>('a'),
    row = await c.get('native');
  expect(row.self).toBe(row);
  expect(row.map.get('a')).toBe(row.shared);
  expect(row.view.buffer).toBe(row.buffer);
  expect(row.date).toEqual(new Date(123));
  expect(row.huge).toBe(2n ** 100n);
  expect(row.regexp).toEqual(/ab/gi);
  expect(row.nan).toBeNaN();
  expect(Object.is(row.negativeZero, -0)).toBe(true);
  expect(Object.hasOwn(row, 'missing')).toBe(true);
  expect(row.set).toEqual(new Set([1, 2]));
  expect((await c.getMany([1, 1n, '1'])).map((r) => r?.name)).toEqual(['one', 'big', 'string']);
  expect((await c.find({ filters: [{ field: 'email', op: 'eq', value: 'a' }] }))[0].id).toBe(
    'native',
  );
  expect((await c.search('search', { text: 'Brotli', vector: [1, 0] })).hits[0]!.id).toBe('native');
  await expect(c.insert({ id: 'dup', email: 'a' })).rejects.toMatchObject({
    code: 'DUPLICATE_KEY',
  });
  expect((await target.verify()).documents).toBe(5);
});
it('pins export snapshots, captures selected collections and supports early iterator return', async () => {
  const db = await fixture(),
    snapshot = await db.snapshot();
  await db.collection<any>('a').update('native', { name: 'new' });
  const collections = ['a'],
    stream = snapshot.exportStream({ collections, blockBytes: 1024 });
  collections[0] = 'a0';
  const target = await memory();
  await target.import(stream);
  expect(await target.collections()).toEqual(['a']);
  expect((await target.collection<any>('a').get('native')).name).toBe('Brotli document');
  await snapshot.close();
  const partial = db.exportStream();
  expect((await partial.next()).done).toBe(false);
  await partial.return(undefined);
  await db.compact();
  await db.collect();
  await expect(db.export({ collections: ['missing'] })).rejects.toMatchObject({
    code: 'SCHEMA_MISMATCH',
  });
  expect(() => db.exportStream({ collections: ['a', 'a'] })).toThrow();
});
it('accepts fragmented streams and captures caller byte arrays synchronously', async () => {
  const source = await fixture(),
    bytes = await source.export(),
    a = await memory(),
    b = await memory(),
    c = await memory();
  const copy = Buffer.from(bytes),
    pending = a.import(copy);
  copy.fill(0);
  await pending;
  async function* fragmented() {
    const buffer = Buffer.alloc(7);
    for (let i = 0; i < bytes.length; i += 7) {
      buffer.set(bytes.subarray(i, i + 7));
      yield buffer.subarray(0, Math.min(7, bytes.length - i));
    }
  }
  await b.import(fragmented());
  await c.import(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  );
  expect((await a.verify()).documents).toBe(5);
  expect((await b.verify()).documents).toBe(5);
  expect((await c.verify()).documents).toBe(5);
});
it('supports explicit merge policies, schema agreement and atomic conflict rollback', async () => {
  const source = await fixture(),
    bytes = await source.export(),
    target = await memory();
  await target.import(bytes);
  await target.collection<any>('a').update('native', { name: 'local' });
  await expect(target.import(bytes)).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  await expect(target.import(bytes, { mode: 'merge' })).rejects.toMatchObject({
    code: 'DUPLICATE_KEY',
  });
  expect((await target.import(bytes, { mode: 'merge', conflicts: 'skip' })).skipped).toBe(5);
  expect((await target.collection<any>('a').get('native')).name).toBe('local');
  expect((await target.import(bytes, { mode: 'merge', conflicts: 'replace' })).imported).toBe(5);
  expect((await target.collection<any>('a').get('native')).name).toBe('Brotli document');
  const incompatible = await memory();
  await incompatible.collection('a').insert({ id: 'other' });
  await expect(incompatible.import(bytes, { mode: 'merge' })).rejects.toMatchObject({
    code: 'SCHEMA_MISMATCH',
  });
  expect(await incompatible.collections()).toEqual(['a']);
});
it('rejects corruption, truncation, trailing bytes and resource-limit violations without publication', async () => {
  const db = await fixture(),
    bytes = await db.export({ blockBytes: 1024 }),
    target = await memory();
  const corrupt = bytes.slice();
  corrupt[55] = corrupt[55]! ^ 1;
  const badMagic = bytes.slice();
  badMagic[0] = 0;
  for (const input of [
    corrupt,
    badMagic,
    bytes.slice(0, -1),
    bytes.slice(0, -44),
    new Uint8Array([...bytes, 1]),
  ]) {
    await expect(target.import(input)).rejects.toThrow();
    expect(await target.collections()).toEqual([]);
  }
  for (const options of [
    { maxFrameBytes: 1024 },
    { maxArchiveBytes: 10 },
    { maxDecodedBytes: 10 },
    { maxDocuments: 1 },
    { maxCollections: 1 },
  ]) {
    await expect(target.import(bytes, options)).rejects.toThrow();
    expect(await target.collections()).toEqual([]);
  }
  await expect(db.export({ maxArchiveBytes: 8 })).rejects.toThrow();
  await expect(db.export({ maxDocuments: 0 })).rejects.toThrow();
  await expect(db.export({ maxCollections: 0 })).rejects.toThrow();
  expect(() => db.exportStream({ quality: 12 })).toThrow();
  expect(() => db.exportStream({ blockBytes: 0 })).toThrow();
  await expect(target.import(bytes, { mode: 'wrong' as never })).rejects.toThrow();
  const bounded = await memory({ maxTransactionOperations: 3 });
  await expect(bounded.import(bytes)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  expect(await bounded.collections()).toEqual([]);
});
it('cancels archives, closes producers, and rolls back a producer failure', async () => {
  const source = await fixture(),
    target = await memory(),
    bytes = await source.export();
  let closed = false;
  async function* broken() {
    try {
      yield bytes.subarray(0, -44);
      throw new Error('producer failed');
    } finally {
      closed = true;
    }
  }
  await expect(target.import(broken())).rejects.toThrow('producer failed');
  expect(closed).toBe(true);
  expect(await target.collections()).toEqual([]);
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await expect(target.import(bytes, { signal: controller.signal })).rejects.toThrow();
  await expect(source.export({ signal: controller.signal })).rejects.toThrow();
  let cancelled = false;
  await expect(
    target.import(
      new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(8));
        },
        cancel() {
          cancelled = true;
        },
      }),
    ),
  ).rejects.toThrow();
  expect(cancelled).toBe(true);
  await expect(target.import([new Uint8Array(), 'wrong' as never])).rejects.toThrow('Uint8Array');
});
it('closes an archive input that an import rejects before reading it', async () => {
  const source = await fixture(),
    bytes = await source.export(),
    target = await memory();
  await target.collection('existing').insert({ id: 1 });
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      c.enqueue(bytes);
      c.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(target.import(stream)).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  expect(cancelled).toBe(true);
  const dir = await mkdtemp(join(tmpdir(), 'defuss-db-import-'));
  try {
    await writeFile(join(dir, 'archive.dfdb.br'), bytes);
    const file = createReadStream(join(dir, 'archive.dfdb.br'));
    await new Promise((resolve) => file.once('open', resolve));
    await expect(target.import(file)).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
    expect(file.destroyed).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const controller = new AbortController();
  controller.abort(new Error('stop'));
  let aborted = false;
  const unread = new ReadableStream<Uint8Array>({
    cancel() {
      aborted = true;
    },
  });
  await expect(target.import(unread, { signal: controller.signal })).rejects.toThrow('stop');
  expect(aborted).toBe(true);
  expect(await target.collections()).toEqual(['existing']);
});
// Produce valid checksums around adversarial logical records, so semantic validation is exercised too.
async function archive(records: unknown[], claimedExtra = 0) {
  await init();
  const parts = records.map((record) => {
    const value = encode(record),
      out = new Uint8Array(value.length + 4);
    new DataView(out.buffer).setUint32(0, value.length, true);
    out.set(value, 4);
    return out;
  });
  const raw = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    raw.set(p, at);
    at += p.length;
  }
  const packed = compress(raw, { quality: 1 }),
    head = new Uint8Array(44),
    end = new Uint8Array(44);
  const h = new DataView(head.buffer);
  h.setUint32(4, raw.length + claimedExtra, true);
  h.setUint32(8, packed.length, true);
  const digest = async (previous: Uint8Array, header: Uint8Array, data: Uint8Array) =>
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new Uint8Array([...previous, ...header.subarray(0, 12), ...data]),
      ),
    );
  head.set(await digest(new Uint8Array(32), head, packed), 12);
  new DataView(end.buffer).setUint32(0, 1, true);
  end.set(await digest(head.subarray(12), end, new Uint8Array()), 12);
  return new Uint8Array([68, 70, 68, 66, 66, 82, 1, 0, ...head, ...packed, ...end]);
}
it('validates logical order, counts, duplicate keys, unique indexes and decompression bounds', async () => {
  const manifest = { type: 'manifest', format: 'defuss-db', version: 2, revision: 1 };
  const schema = {
    type: 'schema',
    collection: 'a',
    schema: {
      version: 1,
      indexes: [{ name: 'x', fields: ['x'], unique: true }],
      searchIndexes: [],
    },
  };
  const doc = {
    type: 'document',
    collection: 'a',
    document: { id: 1, x: 1 } satisfies Document & { x: number },
  };
  const end = { type: 'end', collections: 1, documents: 1 };
  const target = await memory();
  for (const records of [
    [doc],
    [{ ...manifest, version: 1 }, schema, doc, end],
    [manifest],
    [manifest, schema, schema, end],
    [manifest, doc, end],
    [manifest, schema, doc, doc, end],
    [manifest, schema, doc, { ...end, documents: 2 }],
    [manifest, schema, doc, end, doc],
    [manifest, schema, doc, { ...doc, document: { id: 2, x: 1 } }, { ...end, documents: 2 }],
  ]) {
    await expect(target.import(await archive(records))).rejects.toThrow();
    expect(await target.collections()).toEqual([]);
  }
  await expect(target.import(await archive([manifest, schema, doc, end], -1))).rejects.toThrow();
  await expect(target.import(await archive([manifest, schema, doc, end], 1))).rejects.toThrow();
  expect(await target.collections()).toEqual([]);
});
