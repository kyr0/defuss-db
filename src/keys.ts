import { orderBody, orderComponent } from './ordered-key.js';
import { getPath } from './paths.js';
import { normalizeSearchIndex } from './search-config.js';
import { encode, decode } from 'defuss-dson/binary';
import { compileQuery } from 'defuss-dataview/query';
import { DatabaseError } from './errors.js';
import type {
  Document,
  IndexDefinition,
  PrimaryKey,
  Schema,
  MutationLimits,
  NewDocument,
} from './types.js';

export const FORMAT_KEY = '!defuss-db-format';
export function name(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value))
    throw new TypeError('Names must match [A-Za-z][A-Za-z0-9_-]{0,63}.');
  return value;
}
// A string ID's token keeps code units above '"' and writes each other unit as '"' plus the unit + 0x23, so a token
// never contains '!', the separator that follows it in history keys, and sorts in the IDs' code-unit order, like the
// four hex digits per unit it replaces. VERIFIED: (probe, 2026-11-21) with hex tokens of 6-character string IDs, a
// 100,000-document load with one ordered index wrote 163 MiB instead of 107 MiB with numeric IDs and took 4.5 s
// instead of 4.0 s, because every index entry repeats the token.
const ESCAPE = 0x22;
function escapeId(value: string): string {
  let result = '',
    start = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > ESCAPE) continue;
    result += value.slice(start, i) + '"' + String.fromCharCode(code + 0x23);
    start = i + 1;
  }
  return start ? result + value.slice(start) : value;
}
/** The inverse of escapeId, or undefined for a payload escapeId cannot produce. */
function unescapeId(payload: string): string | undefined {
  let result = '',
    start = 0;
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    if (code > ESCAPE) continue;
    const next = payload.charCodeAt(i + 1) - 0x23;
    if (code !== ESCAPE || !(next >= 0 && next <= ESCAPE)) return undefined;
    result += payload.slice(start, i) + String.fromCharCode(next);
    start = ++i + 1;
  }
  return start ? result + payload.slice(start) : payload;
}
export function primary(id: PrimaryKey): string {
  if (typeof id === 'string' && id.length <= 512) return `s${escapeId(id)}`;
  if (typeof id === 'number' && Number.isFinite(id)) return `n${id}`;
  if (typeof id === 'bigint' && id.toString().length <= 512) return `b${id}`;
  throw new TypeError(
    'id must be a string of at most 512 code units, a finite number, or a bigint of at most 512 decimal characters.',
  );
}
/** Invert the primary storage token. Numeric -0 and +0 share one canonical DB identity. */
export function primaryFromToken(token: string): PrimaryKey {
  const payload = token.slice(1);
  if (token[0] === 's' && payload.length <= 1024) {
    const id = unescapeId(payload);
    if (id !== undefined && id.length <= 512) return id;
  }
  if (token[0] === 'n' && payload.length <= 32) {
    const value = Number(payload);
    if (Number.isFinite(value) && String(value) === payload) return value;
  }
  if (token[0] === 'b' && payload.length <= 512 && /^(?:0|-?[1-9][0-9]*)$/.test(payload))
    return BigInt(payload);
  throw new DatabaseError('CORRUPT', 'Invalid typed primary token in ordered index.');
}
export const documentPrefix = (collection: string): string => `d:${collection}:`;
export const documentKey = (collection: string, id: PrimaryKey): string =>
  documentPrefix(collection) + primary(id);
export const schemaKey = (collection: string): string => `s:${collection}`;
export function range(prefix: string): { gte: string; lt: string } {
  return {
    gte: prefix,
    lt: prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1),
  };
}
export function checkedKey(key: string): string {
  if (key.length > 4096)
    throw new RangeError('Encoded index key exceeds the DBSONL 4096-code-unit limit.');
  return key;
}
export { getPath } from './paths.js';
/** Canonicalize exactly the value-equality domain supported by DataView. Never call user toString(). */
function scalar(value: unknown): string {
  if (value === null) return 'z';
  if (value === undefined) return 'u';
  if (typeof value === 'string') {
    if (value.length > 1024) throw new RangeError('String exceeds index-key capacity.');
    // Tuple items are length-prefixed, so an equality key holds the string as it is.
    return `s${value}`;
  }
  if (typeof value === 'number') return `n${value}`; // SameValueZero: -0 equals 0; NaN equals NaN.
  if (typeof value === 'bigint') return `b${value}`;
  if (typeof value === 'boolean') return value ? 't' : 'f';
  if (value instanceof Date) return `d${value.getTime()}`;
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : undefined;
  if (bytes) {
    if (bytes.length > 2048) throw new RangeError('Binary exceeds index-key capacity.');
    let result = 'x';
    for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
    return result;
  }
  throw new DatabaseError(
    'INVALID_INDEX_VALUE',
    'Equality indexes accept scalar, Date and binary fields; objects, arrays, Maps and Sets are not index keys.',
  );
}
export function tuple(values: readonly unknown[]): string {
  let result = '';
  for (const value of values) {
    const item = scalar(value);
    result += `${item.length}:${item}`;
  }
  return checkedKey(result);
}
export const indexPrefix = (collection: string, index: IndexDefinition): string =>
  `${index.order ? 'o' : index.unique ? 'u' : 'i'}:${collection}:${index.name}:`;
export function indexValuePrefix(
  collection: string,
  index: IndexDefinition,
  token: string,
): string {
  return checkedKey(indexPrefix(collection, index) + token + '!');
}
export function indexKey(
  collection: string,
  index: IndexDefinition,
  row: Document,
  token?: string,
): string {
  if (index.order) {
    let key = indexPrefix(collection, index);
    for (let i = 0; i < index.fields.length; i++)
      key = checkedKey(
        key + orderComponent(orderBody(getPath(row, index.fields[i]!)), index.order[i]!),
      );
    return checkedKey(key + (token ?? primary(row.id)));
  }
  const prefix = indexValuePrefix(
    collection,
    index,
    tuple(index.fields.map((field) => getPath(row, field))),
  );
  return checkedKey(index.unique ? prefix : prefix + (token ?? primary(row.id)));
}
export function normalizeIndex(input: IndexDefinition): IndexDefinition {
  if (!input || typeof input !== 'object') throw new TypeError('Invalid index definition.');
  name(input.name);
  if (
    !Array.isArray(input.fields) ||
    !input.fields.length ||
    input.fields.length > 16 ||
    new Set(input.fields).size !== input.fields.length
  )
    throw new TypeError('An index requires 1 to 16 distinct field paths.');
  if (input.temporalUnique !== undefined && typeof input.temporalUnique !== 'boolean')
    throw new TypeError('temporalUnique must be boolean.');
  if (input.temporalUnique && (input.unique === false || input.order))
    throw new TypeError('Temporal uniqueness requires a unique equality index.');
  if (input.unique !== undefined && typeof input.unique !== 'boolean')
    throw new TypeError('unique must be boolean.');
  compileQuery({ filters: input.fields.map((field) => ({ field, op: 'eq', value: undefined })) });
  if (input.order !== undefined) {
    if (
      !Array.isArray(input.order) ||
      input.order.length !== input.fields.length ||
      Array.from(input.order).some((dir) => dir !== 'asc' && dir !== 'desc')
    )
      throw new TypeError('order must specify asc or desc for each field.');
    if (input.unique) throw new TypeError('Declare uniqueness on a separate equality index.');
  }
  return {
    name: input.name,
    fields: [...input.fields],
    unique: input.unique ?? input.temporalUnique ?? false,
    ...(input.temporalUnique ? { temporalUnique: true } : {}),
    ...(input.order ? { order: [...input.order] } : {}),
  };
}
export function readSchema(value: unknown): Schema {
  if (value === undefined) return { version: 1, indexes: [], searchIndexes: [] };
  const schema = value as Schema;
  if (!schema || schema.version !== 1 || !Array.isArray(schema.indexes))
    throw new DatabaseError('CORRUPT', 'Invalid collection schema.');
  const indexes = schema.indexes.map(normalizeIndex);
  if (new Set(indexes.map((index) => index.name)).size !== indexes.length)
    throw new DatabaseError('CORRUPT', 'Duplicate stored index names.');
  const searchIndexes = (schema.searchIndexes ?? []).map(normalizeSearchIndex);
  if (
    searchIndexes.length > 16 ||
    new Set(searchIndexes.map((index) => index.name)).size !== searchIndexes.length
  )
    throw new DatabaseError('CORRUPT', 'Invalid search index definitions.');
  if (schema.activating !== undefined) {
    const m = schema.activating;
    if (!m || !Number.isSafeInteger(m.from) || typeof m.after !== 'string' || schema.history)
      throw new DatabaseError('CORRUPT', 'Invalid pending history baseline.');
    return { version: 1, indexes, searchIndexes, activating: { from: m.from, after: m.after } };
  }
  if (schema.history !== undefined) {
    const start = schema.history?.coverageFrom;
    if (start !== null && (!Number.isSafeInteger(start) || Math.abs(start!) > 8640000000000000))
      throw new DatabaseError('CORRUPT', 'Invalid history coverage.');
    return { version: 1, indexes, searchIndexes, history: { coverageFrom: start } };
  }
  return { version: 1, indexes, searchIndexes };
}
/** DSON cloning captures caller-owned values before the first await, including cycles and shared buffers. */
export function capture<T>(value: T, limits: MutationLimits): T {
  return decode(encode(value, { maxRecordBytes: limits.maxRecordBytes }), {
    maxRecordBytes: limits.maxRecordBytes,
  }) as T;
}
export function assertDocument(value: unknown): asserts value is Document {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new DatabaseError(
      'INVALID_DOCUMENT',
      'A document must be a plain object; native values may be nested.',
    );
  if (!Object.hasOwn(value, 'id'))
    throw new DatabaseError('INVALID_DOCUMENT', 'Document has no own id.');
  primary((value as Document).id);
}
export function captureDocument<T extends Document>(
  value: NewDocument<T> | T,
  limits: MutationLimits,
  generate: boolean,
): T {
  const copy = capture(value, limits) as T;
  if (
    copy &&
    typeof copy === 'object' &&
    !Array.isArray(copy) &&
    (!Object.hasOwn(copy, 'id') || copy.id === undefined) &&
    generate
  ) {
    Object.defineProperty(copy, 'id', {
      value: globalThis.crypto.randomUUID(),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  assertDocument(copy);
  return copy;
}
