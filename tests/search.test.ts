import { afterEach, expect, it } from 'vitest';
import {
  openMemory,
  openDatabase,
  createMemoryBackend,
  type Database,
  type Document,
  type SearchIndexDefinition,
} from '../src/index.js';
import { openDirectory } from '../src/server.js';
import { openDbsonl } from 'defuss-dbsonl';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LexicalSearch } from 'defuss-lexicalsearch';
import { HybridSearch } from 'defuss-search';
import { createLexicalRetriever } from 'defuss-search/lexical';
import { createVectorRetriever } from 'defuss-search/vector';
import { primary } from '../src/keys.js';
const handles: Database[] = [];
const directories: string[] = [];
async function memory() {
  const db = await openMemory();
  handles.push(db);
  return db;
}
afterEach(async () => {
  for (const db of handles.splice(0)) await db.close();
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});
type Row = Document & {
  text?: string;
  vector?: number[] | Float32Array;
  category?: string;
  count?: number;
};
const definitions: SearchIndexDefinition[] = [
  { name: 'words', kind: 'lexical', text: { fields: { text: { path: 'text' } } } },
  { name: 'vectors', kind: 'vector', vector: { path: 'vector', dimensions: 2 } },
  {
    name: 'both',
    kind: 'hybrid',
    text: { fields: { text: { path: 'text' } } },
    vector: { path: 'vector', dimensions: 2 },
  },
];
const rows: Row[] = [
  { id: 1, text: 'red fox jumps', vector: [1, 0], category: 'A' },
  { id: '1', text: 'blue fox sleeps', vector: [0.8, 0.6], category: 'B' },
  { id: 1n, text: 'green turtle', vector: [0, 1], category: 'A' },
  { id: 'sparse', text: 'red fox' },
];
async function fixture(db: Database) {
  const c = db.collection<Row>('items');
  await c.insertMany(rows);
  for (const d of definitions) await c.createSearchIndex(d);
  return c;
}
it('uses upstream lexical, vector and hybrid scores with distinct typed IDs and pre-top-k filtering', async () => {
  const db = await memory(),
    c = await fixture(db);
  const lexical = new LexicalSearch({ fields: { text: {} } });
  for (const row of rows) lexical.add({ id: primary(row.id), fields: { text: row.text! } });
  for (const query of ['fox', '"red fox"', 'fo', 'turtl']) {
    const options = { fuzzy: true, prefix: true, explain: true };
    const expected = lexical.search(query, options);
    const actual = await c.search('words', query, { lexical: options });
    expect(actual.hits.map((h) => [primary(h.id), h.score])).toEqual(
      expected.map((h) => [h.id, h.score]),
    );
  }
  const vector = createVectorRetriever({
    ids: rows.slice(0, 3).map((r) => primary(r.id)),
    vectors: rows.slice(0, 3).map((r) => r.vector!),
  });
  const query = { text: 'red fox', vector: [1, 0] };
  expect((await c.search('vectors', query)).hits.map((h) => primary(h.id))).toEqual(
    (await vector.retrieve(query, { limit: 10 })).map((h) => h.id),
  );
  const hybrid = new HybridSearch({ lexical: createLexicalRetriever(lexical), vector });
  const expected = await hybrid.search(query);
  expect((await c.search('both', query)).hits.map((h) => [primary(h.id), h.score])).toEqual(
    expected.map((h) => [h.id, h.score]),
  );
  expect((await c.search('vectors', query, { ids: [1n], limit: 1 })).hits[0]!.id).toBe(1n);
  expect(
    (
      await c.search('both', query, {
        filter: { where: c.q.eq(c.q.field('category'), c.q.literal('B')) },
        limit: 1,
      })
    ).hits[0]!.id,
  ).toBe('1');
  expect((await c.search('words', 'fox', { ids: [1], limit: 1 })).hits.map((h) => h.id)).toEqual([
    1,
  ]);
  expect((await c.search('vectors', query, { limit: 0 })).hits).toEqual([]);
  expect((await c.search('vectors', query, { offset: 1, limit: 1 })).hits[0]!.id).toBe('1');
  expect((await c.searchIndexes()).length).toBe(3);
  await db.verify();
});
it('invalidates only affected generations and retains old snapshot search through compaction', async () => {
  const db = await memory(),
    c = await fixture(db);
  const initial = await c.search('words', 'fox');
  expect(initial.cacheHit).toBe(false);
  expect((await c.search('words', 'fox')).cacheHit).toBe(true);
  await c.update(1, { count: 1 });
  const same = await c.search('words', 'fox');
  expect(same.generation).toBe(initial.generation);
  expect(same.hits.find((h) => h.id === 1)!.document.count).toBe(1);
  const snap = await db.snapshot();
  try {
    await c.update(1, { text: 'otter', vector: [0, 1] });
    await c.delete('1');
    await db.compact();
    await db.collect();
    expect((await c.search('words', 'fox')).hits.map((h) => h.id)).toEqual(['sparse']);
    expect(
      (await snap.collection<Row>('items').search('words', 'fox')).hits.map((h) => h.id),
    ).toEqual(initial.hits.map((h) => h.id));
    expect((await c.search('words', 'otter')).hits[0]!.id).toBe(1);
  } finally {
    await snap.close();
  }
  await db.verify();
});
it('searches transaction overlays, rolls back all search changes, and handles drop/recreate in one transaction', async () => {
  const db = await memory(),
    c = await fixture(db);
  await expect(
    db.transaction(async (tx) => {
      const t = tx.collection<Row>('items');
      await t.update(1, { text: 'otter' });
      expect((await t.search('words', 'otter')).hits[0]!.id).toBe(1);
      await t.insert({ id: 'new', text: 'otter', vector: [0, 1] });
      expect((await t.search('words', 'otter')).hits.length).toBe(2);
      throw new Error('rollback');
    }),
  ).rejects.toThrow('rollback');
  expect((await c.search('words', 'otter')).hits).toEqual([]);
  await db.transaction(async (tx) => {
    const t = tx.collection<Row>('items');
    expect(await t.dropSearchIndex('words')).toBe(true);
    await t.createSearchIndex(definitions[0]!);
    await t.put({ id: 'new', text: 'otter' });
    await t.createIndex({ name: 'category', fields: ['category'] });
    await t.update(1, { text: 'otter' });
    expect((await t.search('words', 'otter')).hits.length).toBe(2);
  });
  await c.createSearchIndex(definitions[0]!);
  await expect(c.createSearchIndex({ ...definitions[0]!, maxDocuments: 5 })).rejects.toMatchObject({
    code: 'SCHEMA_MISMATCH',
  });
  expect(await c.dropSearchIndex('absent')).toBe(false);
  await db.verify();
});
it('reopens all three search kinds and observes another directory handle updates', async () => {
  const path = await mkdtemp(join(tmpdir(), 'defuss-search-'));
  directories.push(path);
  const a = await openDirectory(path);
  handles.push(a);
  await fixture(a);
  await a.close();
  const b = await openDirectory(path),
    cdb = await openDirectory(path);
  handles.push(b, cdb);
  const bcol = b.collection<Row>('items');
  for (const def of definitions)
    expect(
      (await bcol.search(def.name, { text: 'fox', vector: [1, 0] })).hits.length,
    ).toBeGreaterThan(0);
  await cdb.collection<Row>('items').update(1, { text: 'otter' });
  expect((await bcol.search('words', 'otter')).hits[0]!.id).toBe(1);
  await b.verify();
});
it('rejects invalid vectors, bounded-capacity overflow and cancelled reads without partial publication', async () => {
  const db = await memory(),
    c = db.collection<Row>('items');
  await c.createSearchIndex({
    name: 'v',
    kind: 'vector',
    vector: { path: 'vector', dimensions: 2 },
    maxDocuments: 1,
  });
  for (const vector of [[1], [NaN, 1], [Infinity, 1], [0, 0]])
    await expect(c.put({ id: 'bad', vector })).rejects.toThrow();
  await c.put({ id: 'ok', vector: [1e300, 1e300] });
  await expect(c.put({ id: 'tooMany', vector: [1, 0] })).rejects.toThrow('capacity');
  expect(await c.has('tooMany')).toBe(false);
  await expect(c.search('v', 'missing vector')).rejects.toThrow('require');
  await expect(c.search('v', { text: '', vector: [0, 0] })).rejects.toThrow('nonzero');
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await expect(
    c.search('v', { text: '', vector: [1, 0] }, { signal: controller.signal }),
  ).rejects.toThrow('cancelled');
  await expect(c.getMany(['ok'], { signal: controller.signal })).rejects.toThrow('cancelled');
  await expect(c.search('missing', '')).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  await c.delete('ok');
  await c.put({ id: 'replacement', vector: [1, 0] });
  await db.verify();
});
it('supports dot and TurboQuant strategies and validates text input types', async () => {
  const db = await memory(),
    c = db.collection<Row>('items');
  await c.insertMany(rows);
  await c.createSearchIndex({
    name: 'dot',
    kind: 'vector',
    vector: { path: 'vector', dimensions: 2, metric: 'dot' },
  });
  await c.createSearchIndex({
    name: 'quant',
    kind: 'vector',
    vector: { path: 'vector', dimensions: 2, strategy: 'turboquant', refineCandidates: 10 },
  });
  expect((await c.search('dot', { text: '', vector: [2, 0] })).hits[0]!.score).toBe(2);
  expect((await c.search('quant', { text: '', vector: [1, 0] })).hits[0]!.id).toBe(1);
  await c.createSearchIndex(definitions[0]!);
  await expect(c.put({ id: 'bad', text: 4 as unknown as string })).rejects.toThrow('string');
  await c.deleteMany({ filters: [{ field: 'category', op: 'eq', value: 'A' }] });
  await c.updateMany({}, { text: 'updated' });
  expect((await c.search('words', 'updated')).hits.length).toBe(2);
  await db.verify();
});
it('captures search arguments before awaits and returns independent DSON documents from getMany', async () => {
  const db = await memory(),
    c = await fixture(db);
  const query = { text: 'fox', vector: [1, 0] },
    ids = [1];
  const pending = c.search('both', query, { ids });
  query.vector[0] = 0;
  query.vector[1] = 1;
  ids[0] = 999;
  expect((await pending).hits[0]!.id).toBe(1);
  const docs = await c.getMany([1, 'absent', 1, 1n]);
  expect(docs.map((d) => d?.id)).toEqual([1, undefined, 1, 1n]);
  docs[0]!.text = 'mutated';
  expect(docs[2]!.text).toBe(rows[0]!.text);
});
it('rejects stores written in another format instead of reading them', async () => {
  for (const version of [1, 2, 3, 4]) {
    const backend = createMemoryBackend();
    const raw = await openDbsonl(backend, 'default', { create: true });
    await raw.transaction(async (tx) => {
      tx.put('!defuss-db-format', { format: 'defuss-db', version, id: crypto.randomUUID() });
      tx.put('s:old', { version: 1, indexes: [] });
      tx.put('d:old:' + primary('old'), { id: 'old' });
    });
    await raw.close();
    await expect(openDatabase(backend)).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' });
  }
});

it('keeps schema reads per transaction and avoids rewriting unchanged equality indexes', async () => {
  const raw = await openDbsonl(createMemoryBackend(), 'instrumented', { create: true });
  const { FORMAT_VERSION } = await import('../src/format.js');
  await raw.put('!defuss-db-format', {
    format: 'defuss-db',
    version: FORMAT_VERSION,
    id: crypto.randomUUID(),
  });
  let schemaReads = 0,
    documentReads = 0,
    auditSchemaReads = 0,
    indexPuts = 0;
  const observed = new Proxy(raw, {
    get(target, property) {
      if (property === 'beginRead')
        return async () => {
          const session = await target.beginRead();
          return new Proxy(session, {
            get(reader, key) {
              if (key === 'get')
                return (key: string) => {
                  if (key.startsWith('s:')) auditSchemaReads++;
                  return reader.get(key);
                };
              const value = Reflect.get(reader, key);
              return typeof value === 'function' ? value.bind(reader) : value;
            },
          });
        };
      if (property === 'transaction')
        return (callback: (tx: import('../src/types.js').Writer) => Promise<unknown>) =>
          target.transaction((tx) =>
            callback(
              new Proxy(tx, {
                get(writer, key) {
                  if (key === 'get')
                    return (key: string) => {
                      if (key.startsWith('s:')) schemaReads++;
                      if (key.startsWith('d:')) documentReads++;
                      return writer.get(key);
                    };
                  if (key === 'put')
                    return (key: string, value: unknown) => {
                      if (/^[ui]:/.test(key)) indexPuts++;
                      writer.put(key, value);
                    };
                  return Reflect.get(writer, key);
                },
              }),
            ),
          );
      return Reflect.get(target, property);
    },
  });
  const { Database } = await import('../src/database.js');
  const { DEFAULT_OPTIONS } = await import('defuss-dbsonl');
  const db = new Database(observed, DEFAULT_OPTIONS);
  handles.push(db);
  const c = db.collection<Row>('items');
  await c.createIndex({ name: 'category', fields: ['category'] });
  await c.createIndex({ name: 'text', fields: ['text'], unique: true });
  schemaReads = 0;
  indexPuts = 0;
  await c.insertMany(
    Array.from({ length: 100 }, (_, i) => ({ id: i, text: String(i), category: 'A' })),
  );
  expect(schemaReads).toBe(1);
  expect(indexPuts).toBe(200);
  schemaReads = 0;
  indexPuts = 0;
  documentReads = 0;
  await c.update(1, { count: 1 });
  expect(documentReads).toBe(1);
  expect(schemaReads).toBe(1);
  expect(indexPuts).toBe(0);
  await db.verify();
  expect(auditSchemaReads).toBe(1);
  await db.transaction(async (tx) => {
    const t = tx.collection<Row>('items');
    await t.dropIndex('category');
    await t.createIndex({ name: 'count', fields: ['count'] });
    await t.update(1, { count: 9 });
  });
  expect(
    (await c.find({ filters: [{ field: 'count', op: 'eq', value: 9 }] })).map((row) => row.id),
  ).toEqual([1]);
});

it('persists language analyzers and handles per-field language boosts', async () => {
  const db = await memory(),
    c = db.collection<Document & { en: string; de: string }>('words');
  await c.createSearchIndex({
    name: 'languages',
    kind: 'lexical',
    text: {
      fields: {
        en: { path: 'en', analyzer: 'en' },
        de: { path: 'de', analyzer: 'de' },
      },
    },
  });
  await c.insert({ id: 'one', en: 'running', de: 'Häuser' });
  expect((await c.search('languages', 'run')).hits[0]!.id).toBe('one');
  expect((await c.search('languages', { text: 'Haus', language: 'de-DE' })).hits[0]!.id).toBe(
    'one',
  );
  await db.verify();
});

it('cached search reads conflict with concurrent input changes and hybrid exact promotion stays available', async () => {
  const db = await memory(),
    c = await fixture(db);
  await c.search('words', 'fox');
  await expect(
    db.transaction(async (tx) => {
      await tx.collection('items').search('words', 'fox');
      await c.update(1, { text: 'changed' });
      await tx.collection('audit').insert({ id: 'cannot-commit' });
    }),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(await db.collection('audit').has('cannot-commit')).toBe(false);
  expect(
    (
      await c.search(
        'both',
        { text: 'blue fox sleeps', vector: [0, 1] },
        { hybrid: { exact: 'promote' } },
      )
    ).hits[0]!.id,
  ).toBe('1');
});
it('evicts older search generations and rejects oversized query arrays before storage work', async () => {
  const db = await memory(),
    c = await fixture(db);
  for (let i = 0; i < 5; i++) {
    await c.createSearchIndex({
      name: `cache${i}`,
      kind: 'lexical',
      text: { fields: { text: { path: 'text' } } },
    });
    await c.search(`cache${i}`, 'fox');
  }
  expect((await c.search('cache0', 'fox')).cacheHit).toBe(false);
  await expect(c.search('words', 'fox', { limit: 10_001 })).rejects.toThrow();
  await expect(c.search('vectors', { text: '', vector: { length: 1e9 } })).rejects.toThrow(
    'dimensions',
  );
  await expect(c.search('words', 'a'.repeat(16_385))).rejects.toThrow('text');
});
it('preserves old index values when update callbacks mutate native graphs in place', async () => {
  const db = await openMemory();
  try {
    const c = db.collection<any>('mutated');
    await c.insert({ id: 1, nested: { name: 'before' }, vector: new Float32Array([1, 0]) });
    await c.createIndex({ name: 'name', fields: ['nested.name'], unique: true });
    await c.createSearchIndex({
      name: 'hybrid',
      kind: 'hybrid',
      text: { fields: { name: { path: 'nested.name' } } },
      vector: { path: 'vector', dimensions: 2 },
    });
    await c.update(1, (row) => {
      row.nested.name = 'after';
      row.vector[0] = 0;
      row.vector[1] = 1;
      return row;
    });
    expect(
      await c.find({ filters: [{ field: 'nested.name', op: 'eq', value: 'before' }] }),
    ).toEqual([]);
    expect(
      (await c.find({ filters: [{ field: 'nested.name', op: 'eq', value: 'after' }] }))[0]!.id,
    ).toBe(1);
    expect((await c.search('hybrid', { text: 'after', vector: [0, 1] })).hits[0]!.id).toBe(1);
    await db.verify();
  } finally {
    await db.close();
  }
});
