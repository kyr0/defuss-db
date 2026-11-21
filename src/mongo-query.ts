/**
 * MongoDB's query language over defuss-db: a filter document, a sort document and a projection, typed as the
 * shell types them (unquoted keys, single quotes, ISODate(...)) or as Extended JSON, translated into a collection's
 * own request. `findMongo(collection, filter, { sort, projection })` is the whole round trip.
 *
 * Why translate instead of a second query engine: defuss-db's request (`filters` ANDed + one `where` expression +
 * `sorters`) already answers every operator here, and its planner answers `filters` from an index. Top-level
 * conditions with a plain operator become `filters`, so `{ status: 'paid' }` uses an index on status exactly as a
 * native request would; the rest ($or, $nor, $not, $nin, $exists, dot paths) becomes the `where` expression.
 * VERIFIED: tests/mongo.test.ts runs every operator against a real memory database and reads explain().
 *
 * The module is structural: it reads a collection only through `q`, `find`, `query` and `explain`, so the same
 * file runs against a Collection, a ReadCollection bound with at(date) and a TransactionCollection.
 */

/** A defuss-db filter: field, operator, value (ANDed with the others). */
export interface MongoFilter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}
/** A defuss-db sorter. */
export interface MongoSorter {
  field: string;
  direction: 'asc' | 'desc';
}
/** The expression builders a collection hands out (`collection.q`), the part a filter needs. */
export interface Builders {
  field(key: string): unknown;
  path(path: string): unknown;
  literal(value: unknown): unknown;
  eq(a: unknown, b: unknown): unknown;
  neq(a: unknown, b: unknown): unknown;
  gt(a: unknown, b: unknown): unknown;
  gte(a: unknown, b: unknown): unknown;
  lt(a: unknown, b: unknown): unknown;
  lte(a: unknown, b: unknown): unknown;
  isNullish(a: unknown): unknown;
  and(...e: unknown[]): unknown;
  or(...e: unknown[]): unknown;
  not(e: unknown): unknown;
}
/** What a filter document becomes. */
export interface Translated {
  filters: MongoFilter[];
  where?: unknown;
}
/** A filter, sort or projection: a document, or its text as the shell or Extended JSON writes it. */
export type MongoDocument = Record<string, unknown> | string;
/** The request a filter and a sort become: hand it to find(), query(), count() or explain(). */
export interface MongoRequest {
  filters: MongoFilter[];
  where?: unknown;
  sorters?: MongoSorter[];
}
/** What findMongo reads besides the filter. */
export interface MongoFindOptions {
  /** `{ amount: -1, customer: 1 }` - in the order written. */
  sort?: MongoDocument;
  /** Inclusion `{ customer: 1 }` (the id stays unless `{ id: 0 }`) or exclusion `{ notes: 0 }`; dot paths reach in. */
  projection?: MongoDocument;
  skip?: number;
  limit?: number;
}
/** The part of a collection findMongo uses. */
export interface MongoReadable {
  readonly q: unknown;
  find(request?: object): Promise<unknown[]>;
}

/** A query that does not translate - the message names the part. */
export class QueryError extends Error {
  override name = 'QueryError';
}

type Doc = Record<string, unknown>;
const COMPARE: Record<string, MongoFilter['op']> = {
  $eq: 'eq',
  $ne: 'neq',
  $gt: 'gt',
  $gte: 'gte',
  $lt: 'lt',
  $lte: 'lte',
};

/*
 * MongoDB's matching rules where they differ from defuss-db's operators. VERIFIED: the same filters on MongoDB 9.0.8
 * and defuss-db over null, missing, string, Date and array values (tests/mongo.test.ts 'MongoDB matching rules').
 * - null matches a null or missing field: `in [null, undefined]`, which an index still answers. `$exists` tells them
 *   apart, as `neq` / `eq` against undefined do.
 * - A comparison matches only values of the operand's type: `{ $gt: 4 }` matches no string or Date. defuss-db ranks
 *   types in blocks (booleans, numbers, BigInts, strings, Dates, ...), so one more bound at the edge of the
 *   operand's block keeps the comparison in it, still as a range an ordered index answers.
 * - Not translated: MongoDB matches an array when one element matches; here an array is one value.
 */
const FIRST_DATE = new Date(-8.64e15),
  LAST_DATE = new Date(8.64e15);
type Relational = '$gt' | '$gte' | '$lt' | '$lte';
const RELATIONAL = new Set(['$gt', '$gte', '$lt', '$lte']);
/** The bound that keeps a comparison with `value` inside `value`'s type block; none for other operands. */
function typeBound(op: Relational, value: unknown): Omit<MongoFilter, 'field'> | undefined {
  const above = op === '$gt' || op === '$gte';
  if (typeof value === 'number' && !Number.isNaN(value))
    return above ? { op: 'lte', value: Infinity } : { op: 'gte', value: -Infinity };
  if (typeof value === 'bigint')
    return above ? { op: 'lt', value: '' } : { op: 'gt', value: Infinity };
  if (typeof value === 'string')
    return above ? { op: 'lt', value: FIRST_DATE } : { op: 'gte', value: '' };
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return above ? { op: 'lte', value: LAST_DATE } : { op: 'gte', value: FIRST_DATE };
  if (typeof value === 'boolean')
    return above ? { op: 'lte', value: true } : { op: 'gte', value: false };
  return undefined;
}
/** An `in` list where null also stands for a missing field. */
const withMissing = (values: unknown[]) =>
  values.includes(null) ? [...values, undefined] : values;

/**
 * Reads a document as a query bar holds it: JSON, or the shell's relaxed form - unquoted keys, single-quoted
 * strings, a trailing comma, ISODate("...") / new Date("...") and NumberLong("...") - with Extended JSON's
 * { $date } and { $numberLong }. An empty text is an empty document; `what` names it in an error.
 */
export function parseDocument(text: string, what = 'filter'): Doc {
  const src = (text ?? '').trim();
  if (!src) return {};
  let json = '';
  // walk once: strings are copied (single quotes become double), everything outside them is rewritten
  for (let i = 0; i < src.length; ) {
    const c = src[i]!;
    if (c === '"' || c === "'") {
      let j = i + 1;
      let body = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') {
          // \' is no JSON escape: it is the quote itself
          body += src[j + 1] === "'" ? "'" : src[j]! + (src[j + 1] ?? '');
          j += 2;
        } else {
          body += src[j] === '"' && c === "'" ? '\\"' : src[j]!;
          j++;
        }
      }
      if (j >= src.length) throw new QueryError(`${what}: a string is not closed`);
      json += `"${body}"`;
      i = j + 1;
      continue;
    }
    const rest = src.slice(i);
    const call = /^(?:ISODate|new\s+Date|Date)\(\s*(["'])([^"']*)\1\s*\)/.exec(rest);
    if (call) {
      json += `{"$date":"${call[2]}"}`;
      i += call[0].length;
      continue;
    }
    const long = /^NumberLong\(\s*(["']?)(-?\d+)\1\s*\)/.exec(rest);
    if (long) {
      json += `{"$numberLong":"${long[2]}"}`;
      i += long[0].length;
      continue;
    }
    const key = /^([A-Za-z_$][\w$.]*)(\s*:)/.exec(rest);
    const before = json.trimEnd().at(-1);
    if (key && (before === '{' || before === ',')) {
      json += `"${key[1]}"${key[2]}`;
      i += key[0].length;
      continue;
    }
    json += c;
    i++;
  }
  json = json.replace(/,(\s*[}\]])/g, '$1');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (err) {
    throw new QueryError(`${what}: ${(err as Error).message.replace(/^JSON\.parse: /, '')}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new QueryError(`${what}: a document { ... } is expected`);
  return revive(value) as Doc;
}

/** Extended JSON's wrappers to native values: { $date } → Date, { $numberLong } → BigInt. */
export function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const o = value as Doc;
  const keys = Object.keys(o);
  if (keys.length === 1 && keys[0] === '$date') {
    const d = new Date(o.$date as string);
    if (Number.isNaN(d.getTime())) throw new QueryError(`not a date: ${String(o.$date)}`);
    return d;
  }
  if (keys.length === 1 && keys[0] === '$numberLong') return BigInt(o.$numberLong as string);
  return Object.fromEntries(keys.map((k) => [k, revive(o[k])]));
}

/**
 * A value as Extended JSON text (what parseDocument reads back): a Date becomes { "$date": ISO }, a BigInt
 * { "$numberLong": digits }, a Map an object, a Set an array, binary { "$binary": bytes }.
 */
export function stringify(value: unknown, space: number | string = 2): string {
  const plain = (v: unknown): unknown => {
    if (v instanceof Date) return { $date: Number.isNaN(v.getTime()) ? null : v.toISOString() };
    if (typeof v === 'bigint') return { $numberLong: v.toString() };
    if (v instanceof Map) return Object.fromEntries([...v].map(([k, x]) => [String(k), plain(x)]));
    if (v instanceof Set) return [...v].map(plain);
    if (ArrayBuffer.isView(v))
      return { $binary: [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)] };
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
    if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
    return v;
  };
  return JSON.stringify(plain(value), null, space);
}

const isOperatorDoc = (v: unknown): v is Doc =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => k.startsWith('$'));

/** A $regex that defuss-db can answer: ^prefix, suffix$ or a plain substring (no other pattern syntax). */
function regexOp(field: string, pattern: unknown): MongoFilter {
  const p = pattern instanceof RegExp ? pattern.source : String(pattern);
  const plain = (s: string) => !/[.*+?()[\]{}|\\^$]/.test(s);
  if (p.startsWith('^') && plain(p.slice(1))) return { field, op: 'startsWith', value: p.slice(1) };
  if (p.endsWith('$') && plain(p.slice(0, -1)))
    return { field, op: 'endsWith', value: p.slice(0, -1) };
  if (plain(p)) return { field, op: 'contains', value: p };
  throw new QueryError(`${field}: $regex takes ^prefix, suffix$ or plain text here`);
}

/**
 * A filter document → defuss-db's request: `filters` for the top-level conditions with a plain operator, one
 * `where` expression for the rest ($or, $nor, $not, $nin, $exists, conditions on a dot path).
 */
export function translateFilter(doc: Doc, q: Builders): Translated {
  const filters: MongoFilter[] = [];
  const where: unknown[] = [];
  for (const [key, cond] of Object.entries(doc)) {
    if (key.startsWith('$')) {
      where.push(logical(key, cond, q));
      continue;
    }
    const top = !key.includes('.');
    if (!isOperatorDoc(cond)) {
      if (top && cond === null) filters.push({ field: key, op: 'in', value: [null, undefined] });
      else if (top) filters.push({ field: key, op: 'eq', value: cond });
      else where.push(condition(key, '$eq', cond, q));
      continue;
    }
    for (const [op, value] of Object.entries(cond)) {
      if (op === '$options') continue;
      if (top && op === '$eq' && value === null)
        filters.push({ field: key, op: 'in', value: [null, undefined] });
      else if (top && op in COMPARE && !(op === '$ne' && value === null)) {
        filters.push({ field: key, op: COMPARE[op]!, value });
        const bound = RELATIONAL.has(op) ? typeBound(op as Relational, value) : undefined;
        if (bound) filters.push({ field: key, ...bound });
      } else if (top && op === '$in')
        filters.push({ field: key, op: 'in', value: withMissing(list(key, value)) });
      else if (op === '$regex') {
        if (!top) throw new QueryError(`${key}: $regex works on a top-level field`);
        filters.push(regexOp(key, value));
      } else where.push(condition(key, op, value, q));
    }
  }
  return where.length
    ? { filters, where: where.length === 1 ? where[0] : q.and(...where) }
    : { filters };
}

const list = (key: string, value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new QueryError(`${key}: $in / $nin take an array`);
  return value;
};

/** One field condition as an expression. */
function condition(key: string, op: string, value: unknown, q: Builders): unknown {
  const ref = key.includes('.') ? q.path(key) : q.field(key);
  const equal = (v: unknown) => (v === null ? q.isNullish(ref) : q.eq(ref, q.literal(v)));
  switch (op) {
    case '$eq':
      return equal(value);
    case '$ne':
      return q.not(equal(value));
    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte': {
      const compare = q[COMPARE[op] as 'gt' | 'gte' | 'lt' | 'lte'](ref, q.literal(value));
      const bound = typeBound(op, value);
      return bound
        ? q.and(compare, q[bound.op as 'gt' | 'gte' | 'lt' | 'lte'](ref, q.literal(bound.value)))
        : compare;
    }
    case '$in':
      return q.or(...list(key, value).map(equal));
    case '$nin':
      return q.not(q.or(...list(key, value).map(equal)));
    case '$exists':
      return value ? q.neq(ref, q.literal(undefined)) : q.eq(ref, q.literal(undefined));
    case '$not': {
      if (!isOperatorDoc(value)) throw new QueryError(`${key}: $not takes an operator document`);
      return q.not(q.and(...Object.entries(value).map(([o, v]) => condition(key, o, v, q))));
    }
    default:
      throw new QueryError(`${key}: ${op} is not supported`);
  }
}

/** $and / $or / $nor over sub-documents. */
function logical(op: string, value: unknown, q: Builders): unknown {
  if (!['$and', '$or', '$nor'].includes(op))
    throw new QueryError(`${op} is not supported at the top`);
  if (!Array.isArray(value) || !value.length) throw new QueryError(`${op} takes a non-empty array`);
  const parts = value.map((sub) => {
    if (!sub || typeof sub !== 'object' || Array.isArray(sub))
      throw new QueryError(`${op}: every entry is a document`);
    return asExpression(sub as Doc, q);
  });
  if (op === '$and') return q.and(...parts);
  if (op === '$or') return q.or(...parts);
  return q.not(q.or(...parts));
}

/** A whole sub-document as one expression (inside $or, every condition must be an expression). */
function asExpression(doc: Doc, q: Builders): unknown {
  const parts: unknown[] = [];
  for (const [key, cond] of Object.entries(doc)) {
    if (key.startsWith('$')) parts.push(logical(key, cond, q));
    else if (!isOperatorDoc(cond)) parts.push(condition(key, '$eq', cond, q));
    else
      for (const [op, value] of Object.entries(cond)) {
        if (op === '$regex')
          throw new QueryError(`${key}: $regex works only at the top, not inside $or / $nor`);
        parts.push(condition(key, op, value, q));
      }
  }
  if (!parts.length) return q.eq(q.literal(1), q.literal(1));
  return parts.length === 1 ? parts[0] : q.and(...parts);
}

/** A sort document ({ amount: -1, customer: 1 }) → sorters, in the order written. */
export function translateSort(doc: Doc): MongoSorter[] {
  return Object.entries(doc).map(([field, dir]) => {
    if (dir !== 1 && dir !== -1 && dir !== 'asc' && dir !== 'desc')
      throw new QueryError(`sort: ${field} takes 1 or -1`);
    return { field, direction: dir === -1 || dir === 'desc' ? 'desc' : 'asc' };
  });
}

const asDoc = (v: MongoDocument | undefined, what: string): Doc =>
  typeof v === 'string' ? parseDocument(v, what) : (v ?? {});

/** A filter and a sort as a collection's request (for find, query, count or explain). */
export function mongoRequest(
  q: unknown,
  filter: MongoDocument = {},
  sort?: MongoDocument,
): MongoRequest {
  const { filters, where } = translateFilter(asDoc(filter, 'filter'), q as Builders);
  const sorters = translateSort(asDoc(sort, 'sort'));
  return { filters, ...(where ? { where } : {}), ...(sorters.length ? { sorters } : {}) };
}

/**
 * MongoDB's `find(filter).sort(sort).skip(n).limit(n)` with a projection, on any collection (also one bound with
 * at(date)). The documents come back projected.
 */
export async function findMongo<T = Doc>(
  collection: MongoReadable,
  filter: MongoDocument = {},
  options: MongoFindOptions = {},
): Promise<T[]> {
  const request = mongoRequest(collection.q, filter, options.sort);
  const projection = asDoc(options.projection, 'projection');
  const page = {
    ...(options.skip ? { offset: options.skip } : {}),
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
  };
  const rows = (await collection.find({ ...request, ...page })) as Doc[];
  return rows.map((r) => project(r, projection)) as T[];
}

/**
 * A projection document applied to a document: inclusion ({ customer: 1, amount: 1 }) keeps those fields and the
 * id (unless { id: 0 }), exclusion ({ notes: 0 }) drops them. Dot paths reach into sub-documents.
 */
export function project(doc: Doc, projection: Doc): Doc {
  const entries = Object.entries(projection);
  if (!entries.length) return doc;
  const on = entries.filter(([k, v]) => k !== 'id' && (v === 1 || v === true));
  const off = entries.filter(([k, v]) => k !== 'id' && (v === 0 || v === false));
  if (on.length && off.length)
    throw new QueryError('projection: include or exclude fields, not both');
  const idOff = projection.id === 0 || projection.id === false;
  if (on.length) {
    const out: Doc = idOff ? {} : { id: doc.id };
    for (const [path] of on) {
      const value = getPath(doc, path);
      if (value !== undefined) setPath(out, path, value);
    }
    return out;
  }
  const out = structuredClone(doc);
  for (const [path] of off) deletePath(out, path);
  if (idOff) delete out.id;
  return out;
}

/** The value at a dot path, undefined where the path ends early. */
export function getPath(doc: unknown, path: string): unknown {
  let cur: unknown = doc;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object' || !Object.hasOwn(cur, part)) return undefined;
    cur = (cur as Doc)[part];
  }
  return cur;
}
function setPath(doc: Doc, path: string, value: unknown) {
  const parts = path.split('.');
  let cur = doc;
  for (const part of parts.slice(0, -1)) cur = (cur[part] ??= {}) as Doc;
  cur[parts.at(-1)!] = value;
}
function deletePath(doc: Doc, path: string) {
  const parts = path.split('.');
  let cur: unknown = doc;
  for (const part of parts.slice(0, -1)) {
    if (!cur || typeof cur !== 'object') return;
    cur = (cur as Doc)[part];
  }
  if (cur && typeof cur === 'object') delete (cur as Doc)[parts.at(-1)!];
}
