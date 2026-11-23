import { afterEach, describe, expect, it } from 'vitest';
import { openDbsonl } from 'defuss-dbsonl';
import {
  analyzeSchema,
  checkSchema,
  COLLECTIONS,
  createMemoryBackend,
  inferSchema,
  openDatabase,
  openMemory,
  validateValue,
  ValidationError,
} from '../src/index.js';
import type { Database, JsonSchema } from '../src/index.js';

/**
 * Why: a schema a human reviewed and set is a promise about every later write. A write that slips past it, a rule
 * the schema states but nothing checks, or a schema that analyzeSchema suggested and then rejects the very documents
 * it was inferred from, each break that promise without an error.
 */
const handles: Database[] = [];
async function memory() {
  const db = await openMemory();
  handles.push(db);
  return db;
}
afterEach(async () => {
  for (const db of handles.splice(0)) await db.close();
});

const schema: JsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['search', 'click'] },
    path: { type: 'string', format: 'path' },
    link: { type: 'string', format: 'uri' },
    ms: { type: 'integer' },
  },
  required: ['id', 'type'],
};
const event = (id: string, more: object = {}) => ({ id, type: 'search', path: '/help', ...more });

describe('validateValue and checkSchema', () => {
  it('names every violated rule by JSON Pointer', () => {
    expect(validateValue(schema, event('a', { link: 'https://example.com/x', ms: 3 }))).toEqual([]);
    expect(
      validateValue(schema, { id: 'a', type: 'scroll', path: 'a b', link: 'nope', ms: 1.5 }),
    ).toEqual([
      { path: '/type', keyword: 'enum', message: '"scroll" is not one of "search", "click"' },
      { path: '/path', keyword: 'format', message: '"a b" is not a valid path' },
      { path: '/link', keyword: 'format', message: '"nope" is not a valid uri' },
      { path: '/ms', keyword: 'type', message: 'expected integer, found number' },
    ]);
    expect(validateValue(schema, { id: 'a' })).toEqual([
      { path: '/type', keyword: 'required', message: 'is required' },
    ]);
    // a sub-schema checks one value: what a form field needs before it saves
    expect(validateValue(schema.properties!.type!, 'click')).toEqual([]);
    expect(validateValue(schema.properties!.link!, 'https://a b')).toHaveLength(1);
  });
  it('closed objects, items, alternatives and DSON types', () => {
    const strict: JsonSchema = {
      type: 'object',
      properties: {
        at: { type: 'string', format: 'date-time', 'x-dson': 'date' },
        n: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        tags: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
        m: { type: 'object', 'x-dson': 'map', additionalProperties: { type: 'integer' } },
      },
      additionalProperties: false,
    };
    const good = { at: new Date(0), n: null, tags: ['a'], m: new Map([['k', 1]]) };
    expect(validateValue(strict, good)).toEqual([]);
    expect(
      validateValue(strict, {
        at: '1970-01-01T00:00:00Z',
        n: 'x',
        tags: ['a', 'c'],
        m: new Map([['k', 'v']]),
        extra: 1,
      }).map((i) => `${i.path} ${i.keyword}`),
    ).toEqual(['/at type', '/n anyOf', '/tags/1 enum', '/m/k type', '/extra additionalProperties']);
  });
  it('accepts every document a schema was inferred from', () => {
    const loop: Record<string, unknown> = { id: 'loop', kind: 'self' };
    loop.self = loop;
    const docs = [
      {
        id: 1,
        at: new Date(5),
        big: 2n ** 70n,
        bytes: new Uint8Array([1]),
        m: new Map([['a', { n: 1 }]]),
        s: new Set(['x', 'y']),
        mixed: 'text',
        path: '/a/b',
        link: 'https://example.com',
        note: null,
      },
      { id: 2, mixed: { deep: [1, 'two', null] }, path: 'c/d', link: 'ftp://host/f', note: 'a b' },
      loop,
    ];
    const inferred = inferSchema(docs);
    checkSchema(inferred);
    for (const doc of docs) expect(validateValue(inferred, doc)).toEqual([]);
  });
  it('refuses a keyword or format it would not enforce, by name', () => {
    expect(() => checkSchema({ properties: { a: { type: 'string', pattern: '^a' } } })).toThrow(
      /\/properties\/a: "pattern" is not enforced/,
    );
    expect(() => checkSchema({ type: 'string', format: 'email' })).toThrow(/format "email"/);
    expect(() => checkSchema({ type: 'text' })).toThrow(TypeError);
    expect(() => checkSchema({ enum: [] })).toThrow(TypeError);
    expect(() => checkSchema({ type: 'array', uniqueItems: true })).toThrow(/uniqueItems/);
    expect(() => checkSchema({ type: 'string', 'x-dson': 'bigint' })).toThrow(
      /stands in for type integer/,
    );
    expect(() => checkSchema('string')).toThrow(TypeError);
  });
});

describe('setSchema', () => {
  it('validates inserts, updates and replacements once set, alone and in transactions', async () => {
    const db = await memory();
    const c = db.collection<any>('events');
    expect(await c.schema()).toBeUndefined();
    await c.insert({ id: 'free', type: 'anything goes' });
    await c.delete('free');
    expect(await c.setSchema(schema)).toEqual({
      checked: 0,
      invalid: 0,
      limit: 100,
      documents: [],
    });
    expect(await c.schema()).toEqual(schema);

    await c.insert(event('a'));
    const refused = await c.insert(event('b', { type: 'scroll' })).catch((e) => e);
    expect(refused).toBeInstanceOf(ValidationError);
    expect(refused).toMatchObject({
      code: 'VALIDATION_FAILED',
      collection: 'events',
      id: 'b',
      issues: [{ path: '/type', keyword: 'enum' }],
    });
    expect(refused.message).toBe(
      'Document b violates the schema of events: /type "scroll" is not one of "search", "click".',
    );
    await expect(c.update('a', { path: 'not a path' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(c.put({ id: 'a' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    // one violating document rejects the whole batch
    await expect(c.insertMany([event('c'), event('d', { link: 'x' })])).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      id: 'd',
    });
    await expect(c.updateMany({}, { ms: 'slow' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(
      db.transaction((tx) => tx.collection<any>('events').insert(event('e', { ms: 0.5 }))),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await c.find()).toEqual([event('a')]);
    expect(await c.update('a', { type: 'click', link: 'https://example.com' })).toBe(true);

    // a schema set inside a transaction governs the writes that follow in it; a refused write fails the transaction
    const named = { type: 'object', required: ['name'] };
    await expect(
      db.transaction(async (tx) => {
        const other = tx.collection<any>('other');
        await other.setSchema(named);
        await other.insert({ id: 1 });
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', collection: 'other' });
    expect(await db.collection('other').schema()).toBeUndefined();
    await db.transaction(async (tx) => {
      const other = tx.collection<any>('other');
      await other.setSchema(named);
      expect(await other.schema()).toEqual(named);
      await other.insert({ id: 2, name: 'x' });
    });
    expect(await db.collection('other').count()).toBe(1);
    await db.verify();
  });
  it('does not block on existing documents: it warns, with a bounded count', async () => {
    const db = await memory();
    const c = db.collection<any>('events');
    await c.insertMany([
      ...Array.from({ length: 150 }, (_, i) =>
        event(`bad-${String(i).padStart(3, '0')}`, { type: 'x' }),
      ),
      ...Array.from({ length: 20 }, (_, i) => event(`ok-${i}`)),
    ]);
    const all = await c.setSchema(schema, { limit: 1000 });
    expect(all).toMatchObject({ checked: 170, invalid: 150, limit: 1000 });
    expect(all.warning).toBe(
      'WARNING 150 documents of events violate its schema; first: bad-000 /type "x" is not one of "search", "click"',
    );
    // the default limit of 100 stops the check: the count is a lower bound
    const bounded = await c.setSchema(schema);
    expect(bounded).toMatchObject({ checked: 100, invalid: 100, limit: 100 });
    expect(bounded.documents).toHaveLength(100);
    expect(bounded.documents[0]).toEqual({
      id: 'bad-000',
      issues: [{ path: '/type', keyword: 'enum', message: '"x" is not one of "search", "click"' }],
    });
    expect(bounded.warning).toMatch(
      /^WARNING >= 100 documents of events violate its schema; first: /,
    );
    expect(await c.validateCollection({ limit: 1 })).toMatchObject({
      checked: 1,
      invalid: 1,
      warning: expect.stringMatching(/^WARNING >= 1 document of events violates its schema/),
    });
    await expect(c.validateCollection({ limit: 0 })).rejects.toThrow(RangeError);

    // one document by id; a violating document stays readable and can be repaired
    expect(await c.validateDocument('ok-1')).toEqual([]);
    expect(await c.validateDocument('bad-007')).toEqual([
      { path: '/type', keyword: 'enum', message: '"x" is not one of "search", "click"' },
    ]);
    await expect(c.validateDocument('absent')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(c.update('bad-007', { ms: 1 })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await c.update('bad-007', { type: 'click' });
    expect(await c.validateDocument('bad-007')).toEqual([]);
    // a snapshot validates what it pinned
    const snapshot = await db.snapshot();
    try {
      await c.deleteMany({});
      expect(await snapshot.collection('events').validateCollection({ limit: 1000 })).toMatchObject(
        {
          checked: 170,
          invalid: 149,
        },
      );
    } finally {
      await snapshot.close();
    }
    expect(await c.validateCollection()).toEqual({
      checked: 0,
      invalid: 0,
      limit: 100,
      documents: [],
    });
  });
  it('validate: false stores violating documents through every write, and nothing else skips the check', async () => {
    const db = await memory();
    const c = await db.ensureCollection<any>('events', { $trackHistory: true });
    await c.setSchema(schema);
    const skip = { validate: false };
    await c.insert(event('a', { type: 'legacy' }), skip);
    await c.insertMany([event('b', { type: 'legacy' }), event('c', { type: 'legacy' })], skip);
    for await (const batch of c.insertBatches([[event('d', { type: 'legacy' })]], skip))
      expect(batch.ids).toEqual(['d']);
    await c.put(event('e', { type: 'legacy' }), skip);
    expect(await c.update('a', { ms: 'slow' }, skip)).toBe(true);
    expect(
      await c.updateMany(
        { filters: [{ field: 'id', op: 'eq', value: 'b' }] },
        { ms: 'slow' },
        skip,
      ),
    ).toBe(1);
    await db.transaction(async (tx) => {
      const events = tx.collection<any>('events');
      await events.insert(event('f', { type: 'legacy' }), skip);
      await events.update('f', { ms: 'slow' }, skip);
    });
    expect(await c.validateCollection()).toMatchObject({ checked: 6, invalid: 6 });
    // The option belongs to its call: the next write of the same document is checked again.
    await expect(c.update('a', { link: 'https://example.com' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      id: 'a',
    });
    await expect(
      c.insert(event('g', { type: 'legacy' }), { validate: true }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(() => c.insert(event('g'), { validate: 'no' } as never)).toThrow(TypeError);

    // restore() validates the version it writes back unless told otherwise
    await c.delete('c');
    await expect(c.restore('c')).rejects.toMatchObject({ code: 'VALIDATION_FAILED', id: 'c' });
    expect(await c.get('c')).toBeUndefined();
    expect(await c.restore('c', skip)).toBe(true);
    expect(await c.get('c')).toEqual(event('c', { type: 'legacy' }));
    await c.delete('e');
    await expect(
      db.transaction((tx) => tx.collection<any>('events').restore('e')),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await db.transaction((tx) => tx.collection<any>('events').restore('e', skip));
    expect(await c.has('e')).toBe(true);
    await db.verify();
  });
  it('refuses an unsupported schema, and null removes the schema', async () => {
    const db = await memory();
    const c = db.collection<any>('events');
    await expect(c.setSchema({ type: 'object', minProperties: 1 })).rejects.toThrow(
      /"minProperties" is not enforced/,
    );
    await expect(c.setSchema(undefined as never)).rejects.toThrow(TypeError);
    // a limit out of range is refused before the schema is stored
    await expect(c.setSchema(schema, { limit: 0 })).rejects.toThrow(RangeError);
    expect(await c.schema()).toBeUndefined();
    await c.setSchema(schema);
    await c.setSchema(null);
    expect(await c.schema()).toBeUndefined();
    await c.insert({ id: 'free', type: 'anything goes' });
    expect(await c.validateDocument('free')).toEqual([]);
    await db.verify();
  });
  it('a write that read no schema cannot commit after one is set', async () => {
    const db = await memory();
    const c = db.collection<any>('events');
    await c.insert(event('a'));
    let release!: () => void;
    const set = new Promise<void>((resolve) => (release = resolve));
    const late = db.transaction(async (tx) => {
      const events = tx.collection<any>('events');
      await events.insert(event('late', { type: 'scroll' }));
      await set;
    });
    await c.setSchema(schema);
    release();
    await expect(late).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await c.has('late')).toBe(false);
  });
  it('stamping existing documents keeps the ones that violate the schema', async () => {
    const db = await memory();
    const c = db.collection<any>('events');
    await c.insert(event('old', { type: 'legacy' }));
    await c.setSchema(schema);
    const stamped = await db.ensureCollection<any>('events', { $timestamps: true });
    expect((await stamped.get('old'))._createdAt).toBeInstanceOf(Date);
    expect(await stamped.validateDocument('old')).toHaveLength(1);
  });
  it('validates a timestamped collection after stamping', async () => {
    const db = await memory();
    const c = await db.ensureCollection<any>('stamped', { $timestamps: true });
    await c.insert({ id: 1, kind: 'a' });
    const { schema: inferred } = await analyzeSchema(c);
    expect(inferred.required).toEqual(['id', 'kind', '_createdAt', '_updatedAt']);
    await c.setSchema({ ...inferred, additionalProperties: false });
    await c.insert({ id: 2, kind: 'a' });
    await c.update(1, { kind: 'a' });
    await expect(c.insert({ id: 3, kind: 'b' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('_collections', () => {
  it('holds one entry per ensured collection and every set schema; analyzeSchema writes nothing', async () => {
    const db = await memory();
    const catalog = db.collection(COLLECTIONS);
    expect(COLLECTIONS).toBe('_collections');
    await db.collection<any>('implicit').insert({ id: 1, kind: 'a' });
    await analyzeSchema(db.collection('implicit'));
    expect(await catalog.count()).toBe(0);

    await db.ensureCollection('made');
    await db.ensureCollection('made');
    await db.collection<any>('events').setSchema(schema);
    expect(await catalog.find()).toEqual([{ id: 'events', schema }, { id: 'made' }]);
    expect(await catalog.get('events')).toEqual({ id: 'events', schema });
    expect(await catalog.find({ filters: [{ field: 'id', op: 'eq', value: 'made' }] })).toEqual([
      { id: 'made' },
    ]);
    await db.collection<any>('events').setSchema(null);
    expect(await catalog.get('events')).toEqual({ id: 'events' });

    // the catalog is read-only and no collection of its own
    expect('insert' in catalog).toBe(false);
    expect(() => db.collection('_other')).toThrow(TypeError);
    await expect(db.ensureCollection(COLLECTIONS)).rejects.toThrow(TypeError);
    expect(await db.collections()).toEqual(['events', 'implicit', 'made']);
    expect(await db.verify()).toMatchObject({ collections: 3, documents: 1 });
    await db.transaction(async (tx) => {
      expect(await tx.collection(COLLECTIONS).count()).toBe(2);
      expect('insert' in tx.collection(COLLECTIONS)).toBe(false);
    });
    const snapshot = await db.snapshot();
    try {
      expect(await snapshot.collection(COLLECTIONS).count()).toBe(2);
    } finally {
      await snapshot.close();
    }
  });
  it('an archive carries the entries; an import keeps documents that violate the schema', async () => {
    const source = await memory();
    const c = source.collection<any>('events');
    await c.insert(event('old', { type: 'legacy' }));
    await c.setSchema(schema);
    await source.ensureCollection('made');
    const archive = await source.export();

    const target = await memory();
    await target.import(archive);
    expect(await target.collection(COLLECTIONS).find()).toEqual([
      { id: 'events', schema },
      { id: 'made' },
    ]);
    const copy = target.collection<any>('events');
    expect(await copy.get('old')).toEqual(event('old', { type: 'legacy' }));
    await expect(copy.insert(event('new', { type: 'legacy' }))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await copy.insert(event('new'));
    await target.verify();

    // a target that set another schema keeps it unless the import replaces
    const other = await memory();
    await other.collection<any>('events').setSchema({ type: 'object' });
    await expect(other.import(archive, { mode: 'merge' })).rejects.toMatchObject({
      code: 'SCHEMA_MISMATCH',
    });
    await other.import(archive, { mode: 'merge', conflicts: 'skip' });
    expect(await other.collection('events').schema()).toEqual({ type: 'object' });
    await other.import(archive, { mode: 'merge', conflicts: 'replace' });
    expect(await other.collection('events').schema()).toEqual(schema);
    await other.verify();
  });
  it('verify() reports a schema marker without its schema and an entry without its collection', async () => {
    const backend = createMemoryBackend(),
      db = await openDatabase(backend);
    handles.push(db);
    await db.collection<any>('events').setSchema(schema);
    await db.verify();
    const raw = await openDbsonl<unknown>(backend, 'default');
    try {
      await raw.transaction(async (tx) => void tx.put('d:_collections:sevents', { id: 'events' }));
      await expect(db.verify()).rejects.toMatchObject({
        code: 'CORRUPT',
        message: 'Collection entry and schema marker disagree.',
      });
      await raw.transaction(async (tx) => {
        tx.delete('m:events');
        tx.put('d:_collections:sghost', { id: 'ghost' });
      });
      await expect(db.verify()).rejects.toMatchObject({
        code: 'CORRUPT',
        message: 'Record has no collection.',
      });
      await raw.transaction(async (tx) => {
        tx.delete('d:_collections:sghost');
        tx.delete('d:_collections:sevents');
        tx.put('m:events', 1);
      });
      await expect(db.verify()).rejects.toMatchObject({
        code: 'CORRUPT',
        message: 'Schema marker without a schema.',
      });
    } finally {
      await raw.close();
    }
  });
});
