// Records which documents MongoDB returns for each filter of tests/mongo-semantics.json, which tests/mongo.test.ts
// replays against defuss-db's translator without a server. MONGODB_URL names a running server (default
// mongodb://127.0.0.1:27017); the script creates the throwaway database defuss_db_semantics_<pid> and drops it.
// Why a committed fixture: the test suite runs without a server, and the file names the server version it records.
// VERIFIED: against MongoDB 9.0.8 on 2026-11-22 it wrote 166 cases over 40 documents and dropped its database.
// Values that JSON cannot hold are written as { $date: ms }, { $long: 'digits' }, { $bytes: [...] } and { $number: 'NaN' }.
import { writeFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

const url = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const OUT = 'tests/mongo-semantics.json';
const D = (ms) => ({ $date: ms });
const L = (digits) => ({ $long: digits });
const B = (...bytes) => ({ $bytes: bytes });
const NAN = { $number: 'NaN' };

// Scalars of every type, null and missing, arrays of scalars, empty, with null, nested, of documents, documents
// holding arrays, and values at the edges of the type ranks.
const documents = [
  { a: 5 }, { a: 5.5 }, { a: 'x' }, { a: null }, {}, { a: [5, 'x'] }, { a: [] }, { a: [null] }, { a: [[5]] },
  { a: [{ b: 1 }, { b: 2 }] }, { a: [{ c: 1 }] }, { a: { b: [1, 3] } }, { a: { b: 2 } }, { a: [1, 2, 3] }, { a: true },
  { a: D(5) }, { a: L('7') }, { a: [D(5), 'y'] }, { a: 'Xyz' }, { a: ['abc', 'xbc'] }, { a: [[1, 2], [3]] }, { a: -1 },
  { a: 2 ** 33 }, { a: { b: null } }, { a: [{ b: [5] }, { b: 7 }] }, { a: B(1, 2) }, { a: [{ b: { c: 1 } }] }, { a: 'abc' },
  { a: [3, 3] }, { a: {} },
  // numbers around 2^53 and above, NaN, text with a final line break and backslashes, documents in arrays
  { a: 2 ** 53 }, { a: L('9007199254740993') }, { a: 2 ** 60 }, { a: -(2 ** 60) }, { a: NAN }, { a: 'abc\n' }, { a: 'a\\xb' }, { a: 'a\\.b' },
  { a: [{ b: 1 }, { c: 2 }] }, { a: [NAN, 1] },
].map((doc, i) => ({ id: i + 1, ...doc }));

const filters = [
  // equality, null and whole arrays
  { a: 5 }, { a: 'x' }, { a: null }, { a: [5, 'x'] }, { a: [] }, { a: [5] }, { a: [[5]] }, { a: [1, 2] }, { a: true }, { a: D(5) }, { a: L('7') },
  { a: { $eq: 3 } }, { a: { $eq: null } }, { a: { $eq: [3, 3] } },
  { a: { $ne: 5 } }, { a: { $ne: null } }, { a: { $ne: 'x' } }, { a: { $ne: [5, 'x'] } }, { a: { $ne: [] } },
  // comparisons stay within the operand's type, for each element too
  { a: { $gt: 4 } }, { a: { $gte: 5 } }, { a: { $lt: 3 } }, { a: { $lte: -1 } }, { a: { $gt: 'w' } }, { a: { $gte: 'xbc' } }, { a: { $lt: 'b' } },
  { a: { $gt: D(4) } }, { a: { $lte: D(5) } }, { a: { $gt: L('6') } }, { a: { $gte: true } }, { a: { $gt: 1, $lt: 3 } }, { a: { $gt: 2, $lt: 2.5 } },
  // membership
  { a: { $in: [5, 'y'] } }, { a: { $in: [null] } }, { a: { $in: [[1, 2]] } }, { a: { $in: [] } }, { a: { $in: [3, null] } }, { a: { $in: [D(5), 2] } },
  { a: { $nin: [5] } }, { a: { $nin: [null] } }, { a: { $nin: [5, null] } }, { a: { $nin: [] } },
  // presence, size, all, elemMatch
  { a: { $exists: true } }, { a: { $exists: false } }, { a: { $size: 0 } }, { a: { $size: 1 } }, { a: { $size: 2 } }, { a: { $size: 3 } },
  { a: { $all: [5] } }, { a: { $all: [5, 'x'] } }, { a: { $all: [1, 2] } }, { a: { $all: [[1, 2]] } }, { a: { $all: [] } }, { a: { $all: [3] } },
  { a: { $elemMatch: { $gt: 1, $lt: 3 } } }, { a: { $elemMatch: { $eq: 5 } } }, { a: { $elemMatch: { b: 1 } } }, { a: { $elemMatch: { b: { $gte: 2 } } } },
  { a: { $elemMatch: { $type: 'string' } } }, { a: { $elemMatch: { $in: [null] } } }, { a: { $elemMatch: { b: { $exists: true } } } }, { a: { $all: [{ $elemMatch: { b: 2 } }] } },
  // types
  { a: { $type: 'string' } }, { a: { $type: 'double' } }, { a: { $type: 'int' } }, { a: { $type: 'long' } }, { a: { $type: 'array' } }, { a: { $type: 'object' } },
  { a: { $type: 'null' } }, { a: { $type: 'date' } }, { a: { $type: 'bool' } }, { a: { $type: 'binData' } }, { a: { $type: 'number' } }, { a: { $type: ['string', 'null'] } },
  { a: { $type: 2 } }, { a: { $type: 4 } }, { a: { $type: 'objectId' } },
  // arithmetic and bits
  { a: { $mod: [2, 1] } }, { a: { $mod: [3, 0] } }, { a: { $mod: [2, 0] } }, { a: { $mod: [4, -1] } },
  { a: { $bitsAllSet: [0] } }, { a: { $bitsAllSet: 1 } }, { a: { $bitsAnySet: [1] } }, { a: { $bitsAllClear: [0] } }, { a: { $bitsAnyClear: 3 } }, { a: { $bitsAllSet: [63] } },
  // text
  { a: { $regex: '^x' } }, { a: { $regex: 'bc$' } }, { a: { $regex: 'b' } }, { a: { $regex: '^xyz$', $options: 'i' } }, { a: { $regex: 'X', $options: 'i' } }, { a: { $regex: '^a' } },
  // negation
  { a: { $not: { $gt: 4 } } }, { a: { $not: { $size: 0 } } }, { a: { $not: { $regex: '^x' } } }, { a: { $not: { $in: [5] } } }, { a: { $not: { $type: 'array' } } },
  // dot paths through documents and arrays
  { 'a.b': 1 }, { 'a.b': null }, { 'a.b': { $exists: true } }, { 'a.b': { $exists: false } }, { 'a.b': { $gt: 1 } }, { 'a.b': { $size: 1 } }, { 'a.b.c': 1 },
  { 'a.0': 5 }, { 'a.0.b': 1 }, { 'a.1': 2 }, { 'a.b': [1, 3] }, { 'a.b': { $type: 'array' } }, { 'a.b': { $ne: 1 } }, { 'a.b': { $in: [5, 7] } },
  { 'a.b': { $elemMatch: { $gt: 2 } } }, { 'a.b': { $all: [5] } }, { 'a.0': { $type: 'array' } }, { 'a.b': { $nin: [null] } },
  // logic
  { $or: [{ a: 5 }, { 'a.b': 2 }] }, { $and: [{ a: { $gt: 1 } }, { a: { $lt: 3 } }] }, { $nor: [{ a: null }, { a: { $type: 'string' } }] },
  { $or: [{ a: { $regex: '^x' } }, { a: { $size: 0 } }] }, { a: { $exists: true }, 'a.b': { $exists: false } },
  // numbers and longs compare as numbers
  { a: 7 }, { a: L('5') }, { a: { $in: [7] } }, { a: { $lt: L('6') } }, { a: { $gte: 6.5 } }, { a: { $lt: -0.5 } }, { a: { $ne: 7 } }, { a: { $gt: 2 ** 40 } },
  // exact comparisons across doubles and longs, bits of large doubles, NaN
  { a: { $gte: L('9007199254740993') } }, { a: { $lt: L('9007199254740993') } }, { a: { $gt: L('9007199254740992') } }, { a: { $lte: L('9007199254740992') } },
  { a: 2 ** 53 }, { a: L('9007199254740992') }, { a: { $in: [L('1152921504606846976')] } }, { a: { $gt: 2 ** 59 } }, { a: { $lt: -(2 ** 59) } },
  { a: { $bitsAllSet: [60] } }, { a: { $bitsAllClear: [0] } }, { a: { $bitsAnySet: [62, 63] } }, { a: { $bitsAllSet: [61, 62, 63] } }, { a: { $bitsAnyClear: [60] } },
  { a: NAN }, { a: { $gte: NAN } }, { a: { $gt: NAN } }, { a: { $lte: NAN } }, { a: { $lt: NAN } }, { a: { $in: [NAN] } }, { a: { $ne: NAN } }, { a: { $type: 'double' } },
  // text: a final line break, escapes, case folding
  { a: { $regex: 'bc$' } }, { a: { $regex: '^abc$' } }, { a: { $regex: 'a\\.b' } }, { a: { $regex: '^ABC$', $options: 'i' } }, { a: { $regex: '' } },
  // $elemMatch with logic
  { a: { $elemMatch: { $or: [{ b: 1 }, { c: 3 }] } } }, { a: { $elemMatch: { $and: [{ b: { $exists: true } }, { b: { $gt: 0 } }] } } }, { a: { $elemMatch: { $nor: [{ b: 1 }] } } },
  // positional segments
  { 'a.0': [5] }, { 'a.0': { $size: 1 } }, { 'a.0.0': 5 }, { 'a.0': null }, { 'a.0': { $exists: true } }, { 'a.2': 3 }, { 'a.1.0': 3 },
];

const decode = (v) => {
  if (Array.isArray(v)) return v.map(decode);
  if (!v || typeof v !== 'object') return v;
  if ('$date' in v) return new Date(v.$date);
  if ('$long' in v) return BigInt(v.$long);
  if ('$bytes' in v) return new Uint8Array(v.$bytes);
  if ('$number' in v) return Number(v.$number);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
};

const client = await new MongoClient(url, { useBigInt64: true }).connect();
const db = client.db(`defuss_db_semantics_${process.pid}`);
try {
  const version = (await client.db('admin').command({ buildInfo: 1 })).version;
  const c = db.collection('c');
  await c.insertMany(documents.map(({ id, ...rest }) => ({ _id: id, ...decode(rest) })));
  const cases = [];
  for (const filter of filters) cases.push([filter, (await c.find(decode(filter)).sort({ _id: 1 }).toArray()).map(d => d._id)]);
  const file = { provenance: { mongodb: version, generated: new Date().toISOString().slice(0, 10), script: 'scripts/mongo-semantics-fixture.mjs' }, documents, cases };
  await writeFile(OUT, JSON.stringify(file, null, 0).replace(/\],\[\{/g, '],\n[{') + '\n');
  console.log(`${new Date().toISOString()} info wrote ${OUT} mongodb=${version} cases=${cases.length}`);
} finally {
  await db.dropDatabase();
  await client.close();
}
