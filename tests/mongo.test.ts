import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openMemory } from '../src/index.js';
import type { Collection, Database } from '../src/index.js';
import {
  aggregateMongo,
  findMongo,
  mongoRequest,
  parseDocument,
  parsePipeline,
  project,
  QueryError,
  stringify,
  translatePipeline,
  translateSort,
} from '../src/mongo.js';

/**
 * Why: defuss-db/mongo answers MongoDB's query language and pipelines - a filter that translates to the wrong
 * request returns the wrong documents without an error. These run every supported operator against a real memory
 * database and compare with the documents a plain loop selects.
 */
const docs = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  customer: ['Ada', 'Alan', 'Grace', 'Linus'][i % 4]!,
  country: ['DE', 'AT', 'FR'][i % 3]!,
  amount: (i * 37) % 200,
  paid: i % 2 === 0,
  createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
  address: { city: ['Berlin', 'Wien', 'Paris', 'Lyon'][i % 4]!, zip: String(10000 + i) },
  tags: i % 3 ? ['a', 'b'] : ['a'],
  ...(i % 5 === 0 ? { note: 'call first' } : {}),
}));
type Doc = (typeof docs)[number];

let db: Database;
let orders: Collection<Doc>;
const ids = async (filter: string, sort = '{ id: 1 }') =>
  (await findMongo<Doc>(orders, filter, { sort })).map((r) => r.id);
const expected = (pick: (d: Doc) => boolean) => docs.filter(pick).map((d) => d.id);

beforeAll(async () => {
  db = await openMemory();
  orders = db.collection<Doc>('orders');
  await orders.insertMany(docs);
});
afterAll(() => db.close());

describe('parseDocument: the shell form a query bar holds', () => {
  it('reads JSON and the relaxed form - unquoted keys, single quotes, a trailing comma, ISODate, NumberLong', () => {
    expect(parseDocument('{ "a": 1 }')).toEqual({ a: 1 });
    expect(parseDocument("{ country: 'DE', amount: { $gt: 10, }, }")).toEqual({
      country: 'DE',
      amount: { $gt: 10 },
    });
    expect(parseDocument("{ 'address.city': 'Berlin' }")).toEqual({ 'address.city': 'Berlin' });
    expect(parseDocument("{ at: { $gte: ISODate('2026-01-05') } }")).toEqual({
      at: { $gte: new Date('2026-01-05') },
    });
    expect(parseDocument('{ n: NumberLong("9007199254740993") }')).toEqual({
      n: 9007199254740993n,
    });
    expect(parseDocument('{ at: { "$date": "2026-02-01T00:00:00Z" } }').at).toEqual(
      new Date('2026-02-01T00:00:00Z'),
    );
    expect(parseDocument("{ s: 'it\\'s' }")).toEqual({ s: "it's" });
    expect(parseDocument('   ')).toEqual({});
  });
  it('names what is wrong', () => {
    expect(() => parseDocument('{ a: ', 'filter')).toThrow(QueryError);
    expect(() => parseDocument('[1]', 'sort')).toThrow(/sort: a document/);
    expect(() => parseDocument("{ a: 'open }")).toThrow(/not closed/);
  });
  it('stringify writes Extended JSON that parseDocument reads back', () => {
    const value = { at: new Date('2026-03-01T10:00:00Z'), n: 12n, s: new Set([1]) };
    expect(parseDocument(stringify(value))).toEqual({ at: value.at, n: 12n, s: [1] });
  });
});

describe('findMongo against a real defuss-db', () => {
  it('equality, comparisons and $in on top-level fields', async () => {
    expect(await ids("{ country: 'DE' }")).toEqual(expected((d) => d.country === 'DE'));
    expect(await ids('{ amount: { $gt: 100, $lte: 150 } }')).toEqual(
      expected((d) => d.amount > 100 && d.amount <= 150),
    );
    expect(await ids("{ country: { $ne: 'DE' } }")).toEqual(expected((d) => d.country !== 'DE'));
    expect(await ids("{ customer: { $in: ['Ada', 'Grace'] } }")).toEqual(
      expected((d) => ['Ada', 'Grace'].includes(d.customer)),
    );
    expect(await ids('{ paid: true, amount: { $lt: 50 } }')).toEqual(
      expected((d) => d.paid && d.amount < 50),
    );
    // a document works as well as its text
    expect(
      (
        await findMongo<Doc>(orders, { country: 'FR', amount: { $gte: 150 } }, { sort: { id: 1 } })
      ).map((d) => d.id),
    ).toEqual(expected((d) => d.country === 'FR' && d.amount >= 150));
  });
  it('dates compare by time', async () => {
    expect(await ids("{ createdAt: { $gte: ISODate('2026-02-01') } }")).toEqual(
      expected((d) => d.createdAt >= new Date('2026-02-01')),
    );
  });
  it('dot paths, $nin, $exists and $not', async () => {
    expect(await ids("{ 'address.city': 'Wien' }")).toEqual(
      expected((d) => d.address.city === 'Wien'),
    );
    expect(await ids("{ country: { $nin: ['DE', 'AT'] } }")).toEqual(
      expected((d) => !['DE', 'AT'].includes(d.country)),
    );
    expect(await ids('{ note: { $exists: true } }')).toEqual(expected((d) => 'note' in d));
    expect(await ids('{ note: { $exists: false } }')).toEqual(expected((d) => !('note' in d)));
    expect(await ids('{ amount: { $not: { $gt: 20 } } }')).toEqual(
      expected((d) => !(d.amount > 20)),
    );
  });
  it('$or, $and and $nor', async () => {
    expect(await ids("{ $or: [{ country: 'FR' }, { amount: { $gt: 180 } }] }")).toEqual(
      expected((d) => d.country === 'FR' || d.amount > 180),
    );
    expect(await ids("{ $and: [{ paid: false }, { 'address.city': 'Lyon' }] }")).toEqual(
      expected((d) => !d.paid && d.address.city === 'Lyon'),
    );
    expect(await ids("{ $nor: [{ country: 'DE' }, { paid: true }] }")).toEqual(
      expected((d) => !(d.country === 'DE' || d.paid)),
    );
  });
  it('$regex as a prefix, a suffix or a substring', async () => {
    expect(await ids("{ customer: { $regex: '^Al' } }")).toEqual(
      expected((d) => d.customer.startsWith('Al')),
    );
    expect(await ids("{ customer: { $regex: 'ace$' } }")).toEqual(
      expected((d) => d.customer.endsWith('ace')),
    );
    expect(await ids("{ customer: { $regex: 'nu' } }")).toEqual(
      expected((d) => d.customer.includes('nu')),
    );
    await expect(ids("{ customer: { $regex: 'a.c' } }")).rejects.toThrow(/\$regex takes/);
  });
  it('sort, skip, limit and a projection', async () => {
    const rows = await findMongo(orders, "{ country: 'AT' }", {
      sort: '{ amount: -1, id: 1 }',
      skip: 2,
      limit: 3,
      projection: '{ amount: 1 }',
    });
    const all = docs
      .filter((d) => d.country === 'AT')
      .sort((a, b) => b.amount - a.amount || a.id - b.id);
    expect(rows).toEqual(all.slice(2, 5).map((d) => ({ id: d.id, amount: d.amount })));
    expect(translateSort({ a: 1, b: -1 })).toEqual([
      { field: 'a', direction: 'asc' },
      { field: 'b', direction: 'desc' },
    ]);
    expect(() => translateSort({ a: 2 })).toThrow(/1 or -1/);
  });
  it('an index answers a top-level equality (explain names it); count() takes the same request', async () => {
    await orders.createIndex({ name: 'byCountry', fields: ['country'] });
    const request = mongoRequest(orders.q, "{ country: 'DE' }");
    expect((await orders.explain(request as never)).access.kind).toBe('equality');
    expect(await orders.count(request as never)).toBe(
      docs.filter((d) => d.country === 'DE').length,
    );
  });
  it('includes or excludes fields, dot paths too', () => {
    const d = docs[0]!;
    expect(project(d, { customer: 1, 'address.city': 1 })).toEqual({
      id: 1,
      customer: 'Ada',
      address: { city: 'Berlin' },
    });
    expect(project(d, { customer: 1, id: 0 })).toEqual({ customer: 'Ada' });
    expect(Object.keys(project(d, { address: 0, createdAt: 0 }))).not.toContain('address');
    expect(() => project(d, { a: 1, b: 0 })).toThrow(/not both/);
  });
});

describe('MongoDB matching rules', () => {
  it('match null with missing fields, keep comparisons in the operand type, and answer as MongoDB does', async () => {
    // VERIFIED: MongoDB 9.0.8 on this host returned these ids for the same documents and filters, 2026-11-21.
    const local = await openMemory();
    const c = local.collection<{ id: number; a?: unknown }>('c');
    await c.insertMany([
      { id: 1, a: null },
      { id: 2 },
      { id: 3, a: 5 },
      { id: 4, a: 'x' },
      { id: 7, a: 7 },
      { id: 8, a: new Date(5) },
    ]);
    const cases: [string, number[]][] = [
      ['{ a: null }', [1, 2]],
      ['{ a: { $eq: null } }', [1, 2]],
      ['{ a: { $ne: null } }', [3, 4, 7, 8]],
      ['{ a: { $exists: true } }', [1, 3, 4, 7, 8]],
      ['{ a: { $exists: false } }', [2]],
      ['{ a: { $gt: 4 } }', [3, 7]],
      ['{ a: { $lt: 6 } }', [3]],
      ['{ a: { $ne: 5 } }', [1, 2, 4, 7, 8]],
      ['{ a: { $in: [5, null] } }', [1, 2, 3]],
      ['{ a: { $nin: [5] } }', [1, 2, 4, 7, 8]],
      ['{ a: { $not: { $gt: 4 } } }', [1, 2, 4, 8]],
      ["{ $or: [{ a: 5 }, { a: 'x' }] }", [3, 4]],
      ["{ a: { $gte: 'a' } }", [4]],
      ['{ a: { $lte: ISODate("2026-01-01") } }', [8]],
    ];
    for (const [filter, expected] of cases)
      expect(
        (await findMongo(c, filter, { sort: { id: 1 } })).map((d) => d.id),
        filter,
      ).toEqual(expected);
    // The type bound is one more filter, so an ordered index still answers the range.
    expect(mongoRequest(c.q, { a: { $gt: 4 } }).filters).toEqual([
      { field: 'a', op: 'gt', value: 4 },
      { field: 'a', op: 'lte', value: Infinity },
    ]);
    await local.close();
  });
});

describe('pipelines', () => {
  it('translatePipeline: $match, $group by a field with count, sum and average, $sort and $limit', () => {
    expect(
      translatePipeline(
        parsePipeline(`[
          { $match: { status: 'paid', amount: { $gt: 100 } } },
          { $group: { _id: '$country', orders: { $sum: 1 }, revenue: { $sum: '$amount' }, mean: { $avg: '$amount' } } },
          { $sort: { revenue: -1 } },
          { $limit: 10 }
        ]`),
      ),
    ).toEqual({
      match: { status: 'paid', amount: { $gt: 100 } },
      keys: [{ name: null, field: 'country', by: 'value' }],
      measures: [
        { alias: 'revenue', op: 'sum', field: 'amount' },
        { alias: 'orders', op: 'count' },
        { alias: 'mean', op: 'avg', field: 'amount' },
      ],
      sort: { by: 'measure', direction: 'desc' },
      sorted: true,
      limit: 10,
      count: null,
    });
  });
  it('translatePipeline: keys of a document, case-folded text, date units, $dateToString, $unwind elements, $addToSet + $size', () => {
    const plan = translatePipeline(
      parsePipeline(`[
        { $unwind: '$tags' },
        { $group: { _id: { t: '$tags', c: { $toLower: '$country' }, m: { $dateTrunc: { date: '$createdAt', unit: 'month' } } }, n: { $count: {} }, who: { $addToSet: '$customer' } } },
        { $set: { who: { $size: '$who' } } },
        { $sort: { '_id.m': 1 } }
      ]`),
    );
    expect(plan.keys).toEqual([
      { name: 't', field: 'tags', by: 'each' },
      { name: 'c', field: 'country', by: 'lower' },
      { name: 'm', field: 'createdAt', by: 'month' },
    ]);
    expect(plan.measures[1]).toEqual({ alias: 'who', op: 'countDistinct', field: 'customer' });
    expect(plan.sort).toEqual({ by: 'key', key: 2, direction: 'asc' });
    expect(
      translatePipeline(
        parsePipeline(
          `[{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, n: { $sum: 1 } } }]`,
        ),
      ).keys,
    ).toEqual([{ name: null, field: 'at', by: 'day', output: { format: '%Y-%m-%d' } }]);
  });
  it('aggregateMongo answers in MongoDB shape: _id, accumulators, the order and limit asked for', async () => {
    const rows = await aggregateMongo<Record<string, unknown>>(
      orders,
      `[{ $match: { paid: true } }, { $group: { _id: '$country', n: { $sum: 1 }, total: { $sum: '$amount' }, low: { $min: '$amount' } } }, { $sort: { total: -1 } }, { $limit: 2 }]`,
    );
    const groups = ['DE', 'AT', 'FR']
      .map((c) => {
        const g = docs.filter((d) => d.paid && d.country === c);
        return {
          _id: c,
          total: g.reduce((n, d) => n + d.amount, 0),
          n: g.length,
          low: Math.min(...g.map((d) => d.amount)),
        };
      })
      .sort((a, b) => b.total - a.total);
    expect(rows).toEqual(groups.slice(0, 2));
    expect(Object.keys(rows[0]!)).toEqual(['_id', 'total', 'n', 'low']);
    // _id of a document of fields, _id null, the $count stage (no row when nothing matches)
    const two = await aggregateMongo<{ _id: { c: string; p: boolean }; n: number }>(orders, [
      { $group: { _id: { c: '$country', p: '$paid' }, n: { $sum: 1 } } },
    ]);
    expect(two.length).toBe(6);
    expect(two.every((r) => typeof r._id.c === 'string' && typeof r._id.p === 'boolean')).toBe(
      true,
    );
    expect(await aggregateMongo(orders, [{ $group: { _id: null, all: { $count: {} } } }])).toEqual([
      { _id: null, all: docs.length },
    ]);
    expect(
      await aggregateMongo(orders, "[{ $match: { country: 'DE' } }, { $count: 'n' }]"),
    ).toEqual([{ n: docs.filter((d) => d.country === 'DE').length }]);
    expect(
      await aggregateMongo(orders, "[{ $match: { country: 'XX' } }, { $count: 'n' }]"),
    ).toEqual([]);
  });
  it('aggregateMongo: $year a number, $dateToString text, $toUpper, $addToSet values and their $size', async () => {
    const byYear = await aggregateMongo(orders, [
      { $group: { _id: { $year: '$createdAt' }, n: { $sum: 1 } } },
    ]);
    expect(byYear).toEqual([{ _id: 2026, n: docs.length }]);
    const byMonth = await aggregateMongo(orders, [
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          n: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    expect(byMonth).toEqual([
      { _id: '2026-01', n: 31 },
      { _id: '2026-02', n: 28 },
      { _id: '2026-03', n: 1 },
    ]);
    const who = await aggregateMongo<{ _id: string; cities: string[]; countries: number }>(
      orders,
      `[{ $group: { _id: { $toUpper: '$customer' }, cities: { $addToSet: '$address.city' }, countries: { $addToSet: '$country' } } }, { $set: { countries: { $size: '$countries' } } }, { $sort: { _id: 1 } }]`,
    );
    expect(who.map((r) => r._id)).toEqual(['ADA', 'ALAN', 'GRACE', 'LINUS']);
    expect(who[0]!.countries).toBe(3);
    const tags = await aggregateMongo(orders, [
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    expect(tags).toEqual([
      { _id: 'a', n: docs.length },
      { _id: 'b', n: docs.filter((d) => d.tags.includes('b')).length },
    ]);
  });
  it('names what has no place in one aggregate', () => {
    const plan = (text: string) => translatePipeline(parsePipeline(text));
    expect(() => plan('[{ $lookup: { from: "x" } }]')).toThrow(
      /stage 1: \$lookup is not supported/,
    );
    expect(() =>
      plan(`[{ $group: { _id: '$a', n: { $sum: 1 } } }, { $match: { n: { $gt: 2 } } }]`),
    ).toThrow(/stage 2: \$match after \$group/);
    expect(() => plan(`[{ $group: { _id: '$a', f: { $first: '$b' } } }]`)).toThrow(
      /\$first is not supported/,
    );
    expect(() => plan(`[{ $unwind: '$tags' }, { $group: { _id: '$a', n: { $sum: 1 } } }]`)).toThrow(
      /\$unwind '\$tags' only as a group key/,
    );
    expect(() => plan(`[{ $match: { a: 1 } }]`)).toThrow(/a \$group \(or \$count\)/);
    expect(() => parsePipeline('')).toThrow(/paste a list of stages/);
    const trunc = (options: string) =>
      plan(`[{ $group: { _id: { $dateTrunc: { date: '$at', ${options} } }, n: { $sum: 1 } } }]`);
    expect(() => trunc("unit: 'week'")).toThrow(/startOfWeek: 'monday'/);
    expect(() => trunc("unit: 'day', binSize: 2")).toThrow(/binSize: only 1/);
    expect(() =>
      plan(
        `[{ $group: { _id: { $dateToString: { format: '%Y', date: '$at', onNull: 0 } }, n: { $sum: 1 } } }]`,
      ),
    ).toThrow(/option 'onNull' is not supported/);
  });
  it('aggregateMongo: calendar keys in a time zone and Monday weeks, as MongoDB answers them', async () => {
    // VERIFIED: MongoDB 9.0.8 on this host returned 2026-11-18T23:00:00Z for the Europe/Berlin day of 23:30Z,
    // '2026-11-19' as its $dateToString, and 2026-11-16 as the Monday week of Wednesday 2026-11-18.
    const local = await openMemory();
    const events = local.collection<{ id: number; at: Date }>('events');
    await events.insertMany([
      { id: 1, at: new Date('2026-11-18T23:30:00Z') },
      { id: 2, at: new Date('2026-11-18T12:00:00Z') },
    ]);
    const group = (key: unknown) =>
      aggregateMongo(events, [{ $group: { _id: key, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    expect(
      await group({ $dateTrunc: { date: '$at', unit: 'day', timezone: 'Europe/Berlin' } }),
    ).toEqual([
      { _id: new Date('2026-11-17T23:00:00Z'), n: 1 },
      { _id: new Date('2026-11-18T23:00:00Z'), n: 1 },
    ]);
    expect(
      await group({
        $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'Europe/Berlin' },
      }),
    ).toEqual([
      { _id: '2026-11-18', n: 1 },
      { _id: '2026-11-19', n: 1 },
    ]);
    expect(
      await group({ $dateTrunc: { date: '$at', unit: 'week', startOfWeek: 'Monday' } }),
    ).toEqual([{ _id: new Date('2026-11-16T00:00:00Z'), n: 2 }]);
    await local.close();
  });
});
