import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyzeSchema, inferSchema, JSON_SCHEMA_DIALECT, openMemory } from '../src/index.js';
import type { Database } from '../src/index.js';

/**
 * Why: analyzeSchema describes a collection to validators, form and code generators - a field it calls required
 * that some documents lack, a type it misses, or a sample that sees only the oldest documents misleads all of them.
 */
let db: Database;
beforeAll(async () => {
  db = await openMemory();
});
afterAll(() => db.close());

describe('inferSchema', () => {
  it('types, required, presence, nested objects, arrays and examples', () => {
    const schema = inferSchema(
      [
        { id: 1, name: 'Ada', score: 1, tags: ['a'], address: { city: 'Berlin' } },
        { id: 2, name: 'Alan', score: 2.5, tags: [], address: { city: 'Wien', zip: '1010' } },
        { id: 3, name: null, score: 3, tags: ['b', 1], note: 'x', address: { city: 'Paris' } },
      ],
      // the plain types: no enum, path or URL suggestion
      { title: 'people', higherOrder: false },
    );
    expect(schema).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      title: 'people',
      type: 'object',
      properties: {
        id: { type: 'integer', examples: [1, 2, 3] },
        name: { type: ['string', 'null'], examples: ['Ada', 'Alan'] },
        // 1 and 3 are integers, 2.5 is not: the field is a number
        score: { type: 'number', examples: [2.5, 1, 3] },
        tags: { type: 'array', items: { type: ['string', 'integer'], examples: ['a', 'b', 1] } },
        address: {
          type: 'object',
          properties: {
            city: { type: 'string', examples: ['Berlin', 'Wien', 'Paris'] },
            zip: { type: 'string', examples: ['1010'], 'x-presence': 0.333 },
          },
          required: ['city'],
        },
        note: { type: 'string', examples: ['x'], 'x-presence': 0.333 },
      },
      required: ['id', 'name', 'score', 'tags', 'address'],
    });
  });
  it('DSON values keep a JSON type and name theirs; a cycle stops; examples can be left out', () => {
    const loop: Record<string, unknown> = { id: 'l' };
    loop.self = loop;
    const schema = inferSchema(
      [
        {
          at: new Date('2026-01-01T00:00:00Z'),
          big: 9007199254740993n,
          bytes: new Uint8Array([1, 2]),
          m: new Map([['a', 1]]),
          s: new Set(['x']),
        },
        loop,
      ],
      { examples: 0, higherOrder: false },
    );
    expect(schema.properties).toEqual({
      at: { type: 'string', format: 'date-time', 'x-dson': 'date', 'x-presence': 0.5 },
      big: { type: 'integer', 'x-dson': 'bigint', 'x-presence': 0.5 },
      bytes: { type: 'string', contentEncoding: 'base64', 'x-dson': 'binary', 'x-presence': 0.5 },
      m: {
        type: 'object',
        'x-dson': 'map',
        additionalProperties: { type: 'integer' },
        'x-presence': 0.5,
      },
      s: {
        type: 'array',
        uniqueItems: true,
        'x-dson': 'set',
        items: { type: 'string' },
        'x-presence': 0.5,
      },
      id: { type: 'string', 'x-presence': 0.5 },
      self: {
        $comment: 'a reference back to an enclosing value (a DSON cycle)',
        'x-presence': 0.5,
      },
    });
    // an object and a string at one place: anyOf, since the object has properties
    expect(inferSchema([{ v: 'x' }, { v: { a: 1 } }]).properties!.v).toEqual({
      anyOf: [
        { type: 'string', enum: ['x'] },
        { type: 'object', properties: { a: { type: 'integer', examples: [1] } }, required: ['a'] },
      ],
    });
    expect(inferSchema([])).toEqual({ $schema: JSON_SCHEMA_DIALECT, type: 'object' });
  });
});

/**
 * Why: a string field that only ever holds a few words without whitespace is most likely an enum, one with `/` a
 * path and one with `://` a URL. The rules are the human's (2026-11-23): two or more trailing digits (ev-000001,
 * s-3558) or more than 1,000 distinct values rule an enum out. They stay suggestions: analyzeSchema never stores them.
 */
describe('higher-order string types', () => {
  const events = [
    {
      id: 'ev-000001',
      type: 'search',
      path: '/help',
      session: 's-3558',
      device: 'desktop',
      country: 'GB',
      link: 'https://example.com/a?b=1',
      title: 'Hello world',
      step: 'step-9',
    },
    {
      id: 'ev-000002',
      type: 'page_view',
      path: '/',
      session: 's-2469',
      device: 'mobile',
      country: 'US',
      link: 'http://localhost:4380/x',
      title: 'Shop',
      step: 'step-3',
    },
    {
      id: 'ev-000003',
      type: 'click',
      path: '/shop',
      session: 's-573',
      device: 'desktop',
      country: 'GB',
      link: 'https://example.org',
      title: 'Help',
      step: 'step-9',
    },
  ];
  it('enum, path and uri; trailing digits and whitespace keep a plain string', () => {
    expect(inferSchema(events).properties).toEqual({
      id: { type: 'string', examples: ['ev-000001', 'ev-000002', 'ev-000003'] },
      type: { type: 'string', enum: ['search', 'page_view', 'click'] },
      path: { type: 'string', format: 'path', examples: ['/help', '/', '/shop'] },
      session: { type: 'string', examples: ['s-3558', 's-2469', 's-573'] },
      device: { type: 'string', enum: ['desktop', 'mobile'] },
      country: { type: 'string', enum: ['GB', 'US'] },
      link: {
        type: 'string',
        format: 'uri',
        examples: ['https://example.com/a?b=1', 'http://localhost:4380/x', 'https://example.org'],
      },
      title: { type: 'string', examples: ['Hello world', 'Shop', 'Help'] },
      // one trailing digit is still an enum
      step: { type: 'string', enum: ['step-9', 'step-3'] },
    });
  });
  it("a document's own id is no enum: a schema set from it would refuse every new document", () => {
    expect(
      inferSchema([
        { id: 'a', ref: 'a', sub: { id: 'x' } },
        { id: 'b', ref: 'b' },
      ]).properties,
    ).toEqual({
      id: { type: 'string', examples: ['a', 'b'] },
      ref: { type: 'string', enum: ['a', 'b'] },
      sub: {
        type: 'object',
        properties: { id: { type: 'string', enum: ['x'] } },
        required: ['id'],
        'x-presence': 0.5,
      },
    });
  });
  it('more than 1,000 distinct values are no enum; items of arrays follow the same rules', () => {
    // letters only, so no value ends in digits
    const word = (i: number) => i.toString(26).replace(/\d/g, (d) => 'qrstuvwxyz'[Number(d)]!);
    const docs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, w: word(i) }));
    expect(inferSchema(docs(1000)).properties!.w!.enum).toHaveLength(1000);
    expect(inferSchema(docs(1001), { examples: 0 }).properties!.w).toEqual({ type: 'string' });
    expect(
      inferSchema([{ tags: ['a', 'b'], files: ['src/a.ts', 'README.md'] }]).properties,
    ).toEqual({
      tags: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
      files: {
        type: 'array',
        items: { type: 'string', format: 'path', examples: ['src/a.ts', 'README.md'] },
      },
    });
  });
});

describe('analyzeSchema', () => {
  it('samples across the whole collection, not only its first documents', async () => {
    const c = db.collection('events');
    // ids follow insertion; the field `v2` appears only in the newest tenth
    await c.insertMany(
      Array.from({ length: 2000 }, (_, i) => ({
        id: i + 1,
        kind: 'click',
        ...(i >= 1800 ? { v2: true } : {}),
      })) as never,
    );
    const r = await analyzeSchema(c, { sample: 400 });
    expect(r.sampled).toBe(400);
    expect(r.total).toBe(2000);
    expect(r.at).toBe(null);
    expect(r.schema.title).toBe('events');
    expect(r.schema.description).toBe('Inferred from 400 of 2000 documents.');
    expect(r.schema.required).toEqual(['id', 'kind']);
    const presence = r.schema.properties!.v2!['x-presence']!;
    expect(presence).toBeGreaterThan(0);
    expect(presence).toBeLessThan(1);
    // a small collection is read whole
    const small = db.collection('small');
    await small.insertMany([{ id: 'a', n: 1 }] as never);
    expect((await analyzeSchema(small)).sampled).toBe(1);
  });
  it('at(date): the schema the collection had then; a collection without history says so', async () => {
    const t = await db.ensureCollection('prices', { $trackHistory: true });
    await t.at(new Date('2026-01-01T00:00:00Z')).put({ id: 'plan', eur: 20 } as never);
    await t.update('plan', { currency: 'EUR' } as never);
    const then = await analyzeSchema(t, { at: new Date('2026-02-01T00:00:00Z') });
    expect(Object.keys(then.schema.properties!)).toEqual(['id', 'eur']);
    expect(then.at).toEqual(new Date('2026-02-01T00:00:00Z'));
    expect(then.schema.description).toBe(
      'Inferred from 1 of 1 documents as of 2026-02-01T00:00:00.000Z.',
    );
    expect(Object.keys((await analyzeSchema(t)).schema.properties!)).toEqual([
      'id',
      'eur',
      'currency',
    ]);
    await expect(
      analyzeSchema(db.collection('small'), { at: new Date('2026-01-01') }),
    ).rejects.toMatchObject({ code: 'HISTORY_NOT_ENABLED' });
    await expect(analyzeSchema(t, { sample: 0 })).rejects.toThrow(RangeError);
    await expect(analyzeSchema(t, { at: new Date('nope') })).rejects.toThrow(TypeError);
  });
});
