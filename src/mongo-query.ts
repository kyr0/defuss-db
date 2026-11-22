/**
 * MongoDB's query language over defuss-db: a filter document, a sort document and a projection, typed as the
 * shell types them (unquoted keys, single quotes, ISODate(...)) or as Extended JSON, translated into a collection's
 * own request. `findMongo(collection, filter, { sort, projection })` is the whole round trip.
 *
 * Why translate instead of a second query engine: defuss-db's request (`filters` ANDed + one `where` expression +
 * `sorters`) already answers every operator here, and its planner answers `filters` from an index. MongoDB matches
 * an array when the array or one of its elements matches, and dot paths step through arrays of documents, so in
 * general a condition becomes a `where` expression built with some(). A top-level field that an index covers cannot
 * hold an array (indexes reject array values on write), so its conditions stay `filters`: `{ status: 'paid' }`
 * uses an index on status exactly as a native request would, and so does a range on an ordered index. findMongo
 * and aggregateMongo read the indexes; translateFilter and mongoRequest take them as `scalarFields`.
 * VERIFIED: tests/mongo.test.ts runs every operator against a real memory database and reads explain(), and
 * compares the documents MongoDB 9.0.8 returned for the same filters over scalars, nulls, arrays and subdocuments.
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
/** The expression builders a collection hands out (`collection.q`), the part a filter needs (defuss-dataview 0.10). */
export interface Builders {
  field(key: string): unknown;
  get(expr: unknown, path: string): unknown;
  literal(value: unknown): unknown;
  eq(a: unknown, b: unknown): unknown;
  neq(a: unknown, b: unknown): unknown;
  gt(a: unknown, b: unknown): unknown;
  gte(a: unknown, b: unknown): unknown;
  lt(a: unknown, b: unknown): unknown;
  lte(a: unknown, b: unknown): unknown;
  in(a: unknown, list: unknown): unknown;
  contains(a: unknown, b: unknown): unknown;
  startsWith(a: unknown, b: unknown): unknown;
  endsWith(a: unknown, b: unknown): unknown;
  isNullish(a: unknown): unknown;
  typeOf(a: unknown): unknown;
  lower(a: unknown): unknown;
  length(a: unknown): unknown;
  floor(a: unknown): unknown;
  ceil(a: unknown): unknown;
  div(a: unknown, b: unknown): unknown;
  mod(a: unknown, b: unknown): unknown;
  bitAnd(...e: unknown[]): unknown;
  cond(test: unknown, then: unknown, otherwise: unknown): unknown;
  coalesce(...e: unknown[]): unknown;
  some(list: unknown, predicateFn: (element: unknown) => unknown): unknown;
  and(...e: unknown[]): unknown;
  or(...e: unknown[]): unknown;
  not(e: unknown): unknown;
}
/** Which top-level fields hold no arrays: those an index covers, and the primary key. */
export interface TranslateOptions {
  /** Top-level fields that an index covers; their conditions stay `filters`, which the planner answers from it. */
  scalarFields?: Iterable<string>;
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
  /** The collection's indexes; their top-level fields keep conditions answerable from an index. */
  indexes?(): Promise<readonly { fields: readonly string[] }[]>;
  /** True for a view bound with at(date): a past version may hold an array in a field indexed later. */
  readonly historic?: boolean;
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
 * and defuss-db (tests/mongo.test.ts 'MongoDB matching rules', 2026-11-21 and 2026-11-22).
 * - null matches a null or missing field: `in [null, undefined]`. `$exists` tells them apart, as `neq` / `eq`
 *   against undefined do.
 * - A comparison matches only values of the operand's type: `{ $gt: 4 }` matches no string or Date. defuss-db ranks
 *   types in blocks (booleans, numbers, BigInts, strings, Dates, ...), so one more bound at the edge of the
 *   operand's block keeps the comparison in it, still as a range an ordered index answers.
 * - A condition matches an array when the array itself or one of its elements matches ({ tags: 'a' } matches
 *   ['a', 'b']); $ne and $nin match when none does. $size, $all, $elemMatch and $exists test the value itself.
 * - A dot path steps into the documents of an array on its way ('items.sku' reads the sku of every item), never into
 *   nested arrays or scalars; a numeric segment also indexes an array ('items.0.sku'), and the element it reaches
 *   is matched as it is, without trying its own elements.
 * - Numbers and BigInts (MongoDB's doubles and longs) compare as numbers: { a: 7 } matches 7n, { $gt: 4 } matches 7n.
 *   On an indexed field, where the conditions stay filters, they cover the operand's own kind only: the index keys
 *   numbers and BigInts apart, and the planner answers one key or range from it, not two.
 * - $bitsAllSet and the other bit operators read integral numbers as 64-bit two's complement, BigInts and the bytes
 *   of a Uint8Array (bit 0 is the lowest bit of the first byte).
 * - In $regex, `$` also matches before a final line break: /bc$/ matches 'abc\n'.
 * - NaN equals NaN; $gte and $lte with NaN match NaN only, $gt and $lt nothing.
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

/** A $regex as text tests: `^prefix`, `suffix$`, `^exact$` or plain text, with \-escaped metacharacters; flag i only. */
interface Pattern {
  kind: 'startsWith' | 'endsWith' | 'contains' | 'eq';
  text: string;
  fold: boolean;
}
const META = '.*+?()[]{}|^$';
function pattern(key: string, value: unknown, options: unknown): Pattern {
  const source = value instanceof RegExp ? value.source : value;
  const flags = (value instanceof RegExp ? value.flags : '') + (options === undefined ? '' : String(options));
  if (typeof source !== 'string') throw new QueryError(`${key}: $regex takes a string or a RegExp`);
  if (/[^i]/.test(flags.replace(/[gu]/g, '')))
    throw new QueryError(`${key}: $regex takes the option i only here`);
  const head = source.startsWith('^');
  let tail = false,
    text = '';
  for (let i = head ? 1 : 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === '\\') {
      const next = source[++i];
      if (next === undefined || !(META + '\\/').includes(next))
        throw new QueryError(`${key}: $regex takes ^prefix, suffix$ or plain text here`);
      text += next;
    } else if (c === '$' && i === source.length - 1) tail = true;
    else if (META.includes(c)) throw new QueryError(`${key}: $regex takes ^prefix, suffix$ or plain text here`);
    else text += c;
  }
  const kind = head && tail ? 'eq' : head ? 'startsWith' : tail ? 'endsWith' : 'contains';
  return { kind, text, fold: flags.includes('i') };
}

type Expr = unknown;
type Test = (v: Expr) => Expr;
/** Applies a value test where MongoDB applies it; `elements` also tries the elements of an array found there. */
type Target = (test: Test, elements: boolean) => Expr;
/** Where a path starts: at the row, or at an element that $elemMatch tests as a document. */
type Base = { element?: Expr };
const ROW: Base = {};

const isOperatorDoc = (v: unknown): v is Doc =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  !(v instanceof RegExp) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => k.startsWith('$'));
const isPlainObject = (v: unknown) =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  !(v instanceof RegExp) &&
  !ArrayBuffer.isView(v) &&
  !(v instanceof ArrayBuffer);
/** An operand defuss-db compares by value: no embedded document, also not inside an array. */
function valueOperand(key: string, v: unknown): unknown {
  if (isPlainObject(v) || (Array.isArray(v) && v.some((x) => isPlainObject(x) || x instanceof RegExp)))
    throw new QueryError(`${key}: comparing embedded documents is not supported here; compare their fields with dot paths`);
  return v;
}

/** The values MongoDB finds at a dot path, as a Target. */
function pathTarget(q: Builders, base: Base, key: string): Target {
  const segments = key.split('.');
  if (segments.some((s) => !s)) throw new QueryError(`${key}: a path has no empty segments`);
  const kind = (v: Expr, name: string) => q.eq(q.typeOf(v), q.literal(name));
  return (test, elements) => {
    // `positional`: v is an array's element reached by its index, which MongoDB matches without its elements.
    const walk = (v: Expr, i: number, positional: boolean): Expr => {
      if (i === segments.length) return elements && !positional ? q.or(test(v), q.some(v, (e) => test(e))) : test(v);
      const s = segments[i]!;
      // Only documents have fields: a string, a Date or binary bytes read as missing.
      const field = walk(q.cond(kind(v, 'object'), q.get(v, s), q.literal(undefined)), i + 1, false);
      // Through an array the path continues in its documents only; a numeric segment also indexes the array.
      const through = q.some(v, (e) => q.and(kind(e, 'object'), walk(q.get(e, s), i + 1, false)));
      // A position past the end gives no value at all, unlike a missing field: { 'a.0': null } skips [].
      const index = /^\d+$/.test(s) ? [q.and(kind(v, 'array'), q.gt(q.length(v), q.literal(Number(s))), walk(q.get(v, s), i + 1, true))] : [];
      return q.or(q.and(q.not(kind(v, 'array')), field), ...index, through);
    };
    return 'element' in base ? walk(base.element, 0, false) : walk(q.field(segments[0]!), 1, false);
  };
}
/** One value, as $elemMatch tests an element: no further expansion. */
const valueTarget =
  (v: Expr): Target =>
  (test) =>
    test(v);

const TRUE = (q: Builders) => q.literal(true);
const FALSE = (q: Builders) => q.literal(false);
const finiteNumber = (q: Builders, v: Expr) =>
  q.and(q.eq(q.typeOf(v), q.literal('number')), q.gt(v, q.literal(-Infinity)), q.lt(v, q.literal(Infinity)));
const integral = (q: Builders, v: Expr, low: number, high: number) =>
  q.and(q.eq(q.typeOf(v), q.literal('number')), q.gte(v, q.literal(low)), q.lte(v, q.literal(high)), q.eq(q.floor(v), v));

/** The same integer as the other numeric kind, where both are exact: 7 and 7n, 2 ** 60 and 2n ** 60n. */
function twin(value: unknown): number | bigint | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value !== 'bigint') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && BigInt(n) === value ? n : undefined;
}
/** The adjacent doubles around a BigInt that no double holds exactly; undefined when one does. */
function doublesAround(b: bigint): [number, number] | undefined {
  const n = Number(b);
  if (n === Infinity) return [Number.MAX_VALUE, Infinity];
  if (n === -Infinity) return [-Infinity, -Number.MAX_VALUE];
  if (BigInt(n) === b) return undefined;
  const step = (x: number, up: boolean) => {
    const bits = new BigInt64Array(new Float64Array([x]).buffer);
    bits[0]! += up === x > 0 ? 1n : -1n;
    return new Float64Array(bits.buffer)[0]!;
  };
  return BigInt(n) < b ? [n, step(n, true)] : [step(n, false), n];
}
function equalTest(q: Builders, key: string, value: unknown): Test {
  if (value === null) return (v) => q.isNullish(v);
  if (value instanceof RegExp) return regexTest(q, key, value, undefined);
  const operand = valueOperand(key, value), other = twin(operand);
  return other === undefined ? (v) => q.eq(v, q.literal(operand)) : (v) => q.in(v, q.literal([operand, other]));
}
function compareTest(q: Builders, key: string, op: Relational, value: unknown): Test {
  const ok = ['number', 'bigint', 'string', 'boolean'].includes(typeof value) || value instanceof Date;
  if (!ok) throw new QueryError(`${key}: ${op} takes a number, BigInt, string, Boolean or Date here`);
  if (value instanceof Date && Number.isNaN(value.getTime())) throw new QueryError(`${key}: ${op} takes a valid Date`);
  if (Number.isNaN(value)) return op === '$gte' || op === '$lte' ? (v) => q.eq(v, q.literal(NaN)) : () => FALSE(q);
  const bound = typeBound(op, value);
  const cmp = COMPARE[op] as 'gt' | 'gte' | 'lt' | 'lte';
  const own = (v: Expr) => {
    const compare = q[cmp](v, q.literal(value));
    return bound ? q.and(compare, q[bound.op as 'gt' | 'gte' | 'lt' | 'lte'](v, q.literal(bound.value))) : compare;
  };
  // The other numeric kind: a BigInt is above x exactly when it is above floor(x), and so on.
  const kind = (v: Expr, name: string) => q.eq(q.typeOf(v), q.literal(name));
  if (typeof value === 'number') {
    const above = op === '$gt' || op === '$gte';
    if (!Number.isFinite(value)) return (value > 0) === above ? own : (v) => q.or(own(v), kind(v, 'bigint'));
    const edge = BigInt(op === '$gt' || op === '$lte' ? Math.floor(value) : Math.ceil(value));
    return (v) => q.or(own(v), q.and(kind(v, 'bigint'), q[cmp](v, q.literal(edge))));
  }
  // Numbers against a BigInt: exactly, through the doubles on either side when none equals it.
  if (typeof value === 'bigint') {
    const around = doublesAround(value), above = op === '$gt' || op === '$gte';
    const number = (v: Expr) =>
      around ? (above ? q.gte(v, q.literal(around[1])) : q.lte(v, q.literal(around[0]))) : q[cmp](v, q.literal(Number(value)));
    return (v) => q.or(own(v), q.and(kind(v, 'number'), number(v)));
  }
  return own;
}
function inTest(q: Builders, key: string, value: unknown): Test {
  const members = list(key, value);
  const plain = members
    .filter((m) => m !== null && !(m instanceof RegExp))
    .flatMap((m) => [valueOperand(key, m), ...(twin(m) === undefined ? [] : [twin(m)])]);
  const regexes = members.filter((m): m is RegExp => m instanceof RegExp).map((m) => regexTest(q, key, m, undefined));
  const nullable = members.includes(null);
  return (v) =>
    q.or(
      ...(plain.length ? [q.in(v, q.literal(plain))] : []),
      ...(nullable ? [q.isNullish(v)] : []),
      ...regexes.map((t) => t(v)),
      ...(plain.length || nullable || regexes.length ? [] : [FALSE(q)]),
    );
}
function regexTest(q: Builders, key: string, value: unknown, options: unknown): Test {
  const p = pattern(key, value, options);
  const text = p.fold ? p.text.toLowerCase() : p.text;
  const match = (s: Expr) =>
    p.kind === 'eq'
      ? q.in(s, q.literal([text, `${text}\n`]))
      : p.kind === 'endsWith'
        ? q.or(q.endsWith(s, q.literal(text)), q.endsWith(s, q.literal(`${text}\n`)))
        : q[p.kind](s, q.literal(text));
  return (v) => q.and(q.eq(q.typeOf(v), q.literal('string')), match(p.fold ? q.lower(v) : v));
}
/** $type aliases and numbers; the families defuss-db stores, numbers split as the Node.js driver stores them. */
const TYPES: Record<string, string> = {
  1: 'double', 2: 'string', 3: 'object', 4: 'array', 5: 'binData', 6: 'undefined', 7: 'objectId', 8: 'bool', 9: 'date', 10: 'null',
  11: 'regex', 12: 'dbPointer', 13: 'javascript', 14: 'symbol', 16: 'int', 17: 'timestamp', 18: 'long', 19: 'decimal', '-1': 'minKey', 127: 'maxKey',
};
function typeTest(q: Builders, key: string, value: unknown): Test {
  const names = (Array.isArray(value) ? value : [value]).map((t) => (typeof t === 'number' ? TYPES[t] : t));
  const int32 = (v: Expr) => integral(q, v, -2147483648, 2147483647);
  const one = (name: unknown): Test => {
    switch (name) {
      case 'double': return (v) => q.and(q.eq(q.typeOf(v), q.literal('number')), q.not(int32(v)));
      case 'int': return int32;
      case 'long': return (v) => q.eq(q.typeOf(v), q.literal('bigint'));
      case 'number': return (v) => q.in(q.typeOf(v), q.literal(['number', 'bigint']));
      case 'string': case 'object': case 'array': case 'date': case 'null': return (v) => q.eq(q.typeOf(v), q.literal(name));
      case 'bool': return (v) => q.eq(q.typeOf(v), q.literal('boolean'));
      case 'binData': return (v) => q.eq(q.typeOf(v), q.literal('binary'));
      // No defuss-db value has these types.
      case 'undefined': case 'objectId': case 'regex': case 'dbPointer': case 'javascript': case 'symbol': case 'timestamp': case 'decimal': case 'minKey': case 'maxKey':
        return () => FALSE(q);
      default: throw new QueryError(`${key}: $type ${JSON.stringify(name)} is not a BSON type`);
    }
  };
  const tests = names.map(one);
  return (v) => q.or(...tests.map((t) => t(v)));
}
function modTest(q: Builders, key: string, value: unknown): Test {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((x) => typeof x === 'number' && Number.isFinite(x)))
    throw new QueryError(`${key}: $mod takes [divisor, remainder]`);
  const [d, r] = (value as number[]).map(Math.trunc) as [number, number];
  if (!d) throw new QueryError(`${key}: $mod divisor cannot be 0`);
  // MongoDB truncates a double toward zero and takes a long's remainder exactly.
  return (v) =>
    q.or(
      q.and(finiteNumber(q, v), q.eq(q.mod(q.cond(q.lt(v, q.literal(0)), q.ceil(v), q.floor(v)), q.literal(d)), q.literal(r))),
      q.and(q.eq(q.typeOf(v), q.literal('bigint')), q.eq(q.mod(v, q.literal(BigInt(d))), q.literal(BigInt(r)))),
    );
}
const BITS = new Set(['$bitsAllSet', '$bitsAnySet', '$bitsAllClear', '$bitsAnyClear']);
function bitsTest(q: Builders, key: string, op: string, value: unknown): Test {
  let mask = 0n;
  if (Array.isArray(value)) {
    for (const bit of value) {
      if (!Number.isSafeInteger(bit) || bit < 0 || bit > 63) throw new QueryError(`${key}: ${op} takes bit positions from 0 to 63`);
      mask |= 1n << BigInt(bit);
    }
  } else if (Number.isSafeInteger(value) && (value as number) >= 0) mask = BigInt(value as number);
  else throw new QueryError(`${key}: ${op} takes a nonnegative bitmask or a list of bit positions`);
  // A safe integer's bits 53 to 63 copy its sign, so those positions are set exactly for negative numbers. A larger
  // integral double (up to 2^63) is read bit by bit: bit k is the parity of floor(v / 2^k), exact for doubles.
  const low = Number(mask & ((1n << 53n) - 1n)), high = mask >> 53n !== 0n;
  const all = op === '$bitsAllSet' || op === '$bitsAllClear', set = op === '$bitsAllSet' || op === '$bitsAnySet';
  const lowTest = (word: Expr, m: Expr, zero: Expr) =>
    all ? q.eq(word, set ? m : zero) : q.neq(word, set ? zero : m);
  return (v) => {
    const number = q.and(
      integral(q, v, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
      ...(high
        ? [all ? q[set ? 'lt' : 'gte'](v, q.literal(0)) : q.or(lowTest(q.bitAnd(v, q.literal(low)), q.literal(low), q.literal(0)), q[set ? 'lt' : 'gte'](v, q.literal(0)))]
        : []),
      ...(all || !high ? [lowTest(q.bitAnd(v, q.literal(low)), q.literal(low), q.literal(0))] : []),
    );
    const positions = Array.from({ length: 64 }, (_, k) => k).filter((k) => (mask >> BigInt(k)) & 1n);
    const bit = (k: number) => {
      const odd = q.neq(q.mod(q.floor(q.div(v, q.literal(2 ** k))), q.literal(2)), q.literal(0));
      return set ? odd : q.not(odd);
    };
    const wide = q.and(
      integral(q, v, -(2 ** 63), 2 ** 63),
      q.lt(v, q.literal(2 ** 63)),
      q.or(q.lt(v, q.literal(Number.MIN_SAFE_INTEGER)), q.gt(v, q.literal(Number.MAX_SAFE_INTEGER))),
      positions.length ? (all ? q.and(...positions.map(bit)) : q.or(...positions.map(bit))) : all ? TRUE(q) : FALSE(q),
    );
    const big = q.and(q.eq(q.typeOf(v), q.literal('bigint')), lowTest(q.bitAnd(v, q.literal(mask)), q.literal(mask), q.literal(0n)));
    // Bytes beyond the end of the value count as zero bits.
    const bytes = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => {
      const m = Number((mask >> BigInt(8 * k)) & 0xffn);
      return m ? [lowTest(q.bitAnd(q.coalesce(q.get(v, String(k)), q.literal(0)), q.literal(m)), q.literal(m), q.literal(0))] : [];
    });
    const binary = q.and(q.eq(q.typeOf(v), q.literal('binary')), ...(bytes.length ? [all ? q.and(...bytes) : q.or(...bytes)] : [all ? TRUE(q) : FALSE(q)]));
    return q.or(number, wide, big, binary);
  };
}

/** One operator of a field condition, at `at`. */
function operator(q: Builders, at: Target, key: string, op: string, value: unknown, cond: Doc): Expr {
  switch (op) {
    case '$eq':
      return at(equalTest(q, key, value), true);
    case '$ne':
      return q.not(at(equalTest(q, key, value), true));
    case '$gt':
    case '$gte':
    case '$lt':
    case '$lte':
      return at(compareTest(q, key, op, value), true);
    case '$in':
      return at(inTest(q, key, value), true);
    case '$nin':
      return q.not(at(inTest(q, key, value), true));
    case '$regex':
      return at(regexTest(q, key, value, cond.$options), true);
    case '$type':
      return at(typeTest(q, key, value), true);
    case '$mod':
      return at(modTest(q, key, value), true);
    case '$exists': {
      const exists = at((v) => q.neq(v, q.literal(undefined)), false);
      return value ? exists : q.not(exists);
    }
    case '$size':
      if (!Number.isSafeInteger(value) || (value as number) < 0) throw new QueryError(`${key}: $size takes a nonnegative integer`);
      return at((v) => q.and(q.eq(q.typeOf(v), q.literal('array')), q.eq(q.length(v), q.literal(value))), false);
    case '$all': {
      const entries = list(key, value);
      if (!entries.length) return FALSE(q);
      return q.and(
        ...entries.map((x) =>
          isOperatorDoc(x) && Object.keys(x).length === 1 && '$elemMatch' in x
            ? operator(q, at, key, '$elemMatch', x.$elemMatch, x)
            : at(equalTest(q, key, x), true),
        ),
      );
    }
    case '$elemMatch': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new QueryError(`${key}: $elemMatch takes a document`);
      const sub = value as Doc;
      return at((v) => q.some(v, (e) => elementMatch(q, key, e, sub)), false);
    }
    case '$not': {
      if (value instanceof RegExp) return q.not(at(regexTest(q, key, value, undefined), true));
      if (!isOperatorDoc(value)) throw new QueryError(`${key}: $not takes an operator document or a RegExp`);
      return q.not(operators(q, at, key, value));
    }
    default:
      if (BITS.has(op)) return at(bitsTest(q, key, op, value), true);
      throw new QueryError(`${key}: ${op} is not supported`);
  }
}
function checkOptions(key: string, cond: Doc) {
  if ('$options' in cond && !('$regex' in cond)) throw new QueryError(`${key}: $options needs $regex`);
}
function operators(q: Builders, at: Target, key: string, cond: Doc): Expr {
  checkOptions(key, cond);
  const parts = Object.entries(cond)
    .filter(([op]) => op !== '$options')
    .map(([op, value]) => operator(q, at, key, op, value, cond));
  return parts.length === 1 ? parts[0] : q.and(...parts);
}
/**
 * $elemMatch on one element: operators test the element itself; a query document reads its paths, from a document
 * or an array element (MongoDB skips scalar elements there).
 */
const LOGICAL = new Set(['$and', '$or', '$nor']);
function elementMatch(q: Builders, key: string, e: Expr, sub: Doc): Expr {
  if (isOperatorDoc(sub) && !Object.keys(sub).every((k) => LOGICAL.has(k))) return operators(q, valueTarget(e), key, sub);
  return q.and(q.in(q.typeOf(e), q.literal(['object', 'array'])), documentCondition(q, sub, { element: e }));
}
/** A field's condition: a value (equality, or a RegExp) or an operator document. */
function fieldCondition(q: Builders, base: Base, key: string, cond: unknown): Expr {
  const at = pathTarget(q, base, key);
  return isOperatorDoc(cond) ? operators(q, at, key, cond) : at(equalTest(q, key, cond), true);
}
/** A whole document as one expression. */
function documentCondition(q: Builders, doc: Doc, base: Base): Expr {
  const parts = Object.entries(doc).map(([key, cond]) =>
    key.startsWith('$') ? logical(q, key, cond, base) : fieldCondition(q, base, key, cond),
  );
  if (!parts.length) return TRUE(q);
  return parts.length === 1 ? parts[0] : q.and(...parts);
}
/** $and / $or / $nor over sub-documents. */
function logical(q: Builders, op: string, value: unknown, base: Base): Expr {
  if (!['$and', '$or', '$nor'].includes(op)) throw new QueryError(`${op} is not supported at the top`);
  if (!Array.isArray(value) || !value.length) throw new QueryError(`${op} takes a non-empty array`);
  const parts = value.map((sub) => {
    if (!sub || typeof sub !== 'object' || Array.isArray(sub)) throw new QueryError(`${op}: every entry is a document`);
    return documentCondition(q, sub as Doc, base);
  });
  if (op === '$and') return q.and(...parts);
  if (op === '$or') return q.or(...parts);
  return q.not(q.or(...parts));
}

/**
 * The conditions on a field that holds no arrays as `filters`, which an index answers; undefined for an operator
 * that has no filter form there.
 */
function scalarFilters(key: string, op: string, value: unknown, cond: Doc): MongoFilter[] | undefined {
  if (op === '$eq' && value === null) return [{ field: key, op: 'in', value: [null, undefined] }];
  if (op === '$eq' || op === '$ne') {
    if (value === null || value instanceof RegExp) return undefined;
    return [{ field: key, op: COMPARE[op]!, value: valueOperand(key, value) }];
  }
  if (RELATIONAL.has(op)) {
    compareTest({} as Builders, key, op as Relational, value);
    if (Number.isNaN(value)) return undefined;
    const bound = typeBound(op as Relational, value);
    return [{ field: key, op: COMPARE[op]!, value }, ...(bound ? [{ field: key, ...bound }] : [])];
  }
  if (op === '$in') {
    const members = list(key, value);
    if (members.some((m) => m instanceof RegExp)) return undefined;
    return [{ field: key, op: 'in', value: withMissing(members.map((m) => (m === null ? m : valueOperand(key, m)))) }];
  }
  if (op === '$regex') {
    const p = pattern(key, value, cond.$options);
    if (p.fold || p.kind === 'endsWith') return undefined;
    return [p.kind === 'eq' ? { field: key, op: 'in', value: [p.text, `${p.text}\n`] } : { field: key, op: p.kind, value: p.text }];
  }
  return undefined;
}

/**
 * A filter document → defuss-db's request: `filters` for the conditions on top-level fields that hold no arrays
 * (`scalarFields`, and the primary key `id`), one `where` expression for the rest.
 */
export function translateFilter(doc: Doc, q: Builders, options: TranslateOptions = {}): Translated {
  const scalar = new Set(['id', ...(options.scalarFields ?? [])]);
  const filters: MongoFilter[] = [];
  const where: Expr[] = [];
  for (const [key, cond] of Object.entries(doc)) {
    if (key.startsWith('$')) {
      where.push(logical(q, key, cond, ROW));
      continue;
    }
    if (key.includes('.') || !scalar.has(key)) {
      where.push(fieldCondition(q, ROW, key, cond));
      continue;
    }
    if (isOperatorDoc(cond)) checkOptions(key, cond);
    const entries: [string, unknown][] = isOperatorDoc(cond)
      ? Object.entries(cond).filter(([op]) => op !== '$options')
      : [[cond instanceof RegExp ? '$regex' : '$eq', cond]];
    const at = pathTarget(q, ROW, key);
    for (const [op, value] of entries) {
      const own = scalarFilters(key, op, value, isOperatorDoc(cond) ? cond : {});
      if (own) filters.push(...own);
      else where.push(operator(q, at, key, op, value, isOperatorDoc(cond) ? cond : {}));
    }
  }
  return where.length ? { filters, where: where.length === 1 ? where[0] : q.and(...where) } : { filters };
}

const list = (key: string, value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new QueryError(`${key}: $in, $nin and $all take an array`);
  return value;
};

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
  options: TranslateOptions = {},
): MongoRequest {
  const { filters, where } = translateFilter(asDoc(filter, 'filter'), q as Builders, options);
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
  const request = mongoRequest(collection.q, filter, options.sort, await scalarOptions(collection));
  const projection = asDoc(options.projection, 'projection');
  const page = {
    ...(options.skip ? { offset: options.skip } : {}),
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
  };
  const rows = (await collection.find({ ...request, ...page })) as Doc[];
  return rows.map((r) => project(r, projection)) as T[];
}

/** The top-level fields of a collection's indexes: indexes reject arrays, so these fields never hold one. */
export async function scalarOptions(collection: Pick<MongoReadable, 'indexes' | 'historic'>): Promise<TranslateOptions> {
  // A past version may hold an array in a field indexed later: indexes check only the versions they were built on.
  if (collection.historic || typeof collection.indexes !== 'function') return {};
  const fields = (await collection.indexes()).flatMap((index) => index.fields.filter((f) => !f.includes('.')));
  return { scalarFields: fields };
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
