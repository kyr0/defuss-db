import { estimateRowBytes } from 'defuss-dataview/stream';
import { collectionVersion } from './collection-version.js';
import { DatabaseError } from './errors.js';
import { storeIdentity } from './format.js';
import {
  FORMAT_KEY,
  documentPrefix,
  indexKey,
  name,
  primary,
  primaryFromToken,
  range,
  readSchema,
  schemaKey,
} from './keys.js';
import { orderedSpan, rangeOps, type BoundTerm, type Bounds } from './ordered-access.js';
import { orderBody } from './ordered-key.js';
import type { Row } from 'defuss-dbsonl';
import { readKeys } from './reads.js';
import type {
  Document,
  IndexPage,
  IndexPageOptions,
  IndexRangeOptions,
  IndexCountOptions,
  Reader,
  ReadContext,
} from './types.js';

type Cursor = [1, string, string, string, string, string, string, string];
function invalidCursor(): never {
  throw new DatabaseError(
    'INVALID_CURSOR',
    'Cursor does not belong to this database, index or range.',
  );
}
function parseCursor(token: string): Cursor {
  if (typeof token !== 'string' || token.length > 24576 || !/^[A-Za-z0-9_-]+$/.test(token))
    invalidCursor();
  try {
    const data: unknown = JSON.parse(atob(token.replaceAll('-', '+').replaceAll('_', '/')));
    if (
      Array.isArray(data) &&
      data.length === 8 &&
      data[0] === 1 &&
      data.slice(1).every((v) => typeof v === 'string')
    )
      return data as Cursor;
  } catch {
    /* malformed base64/JSON */
  }
  return invalidCursor();
}
function encodeCursor(cursor: Cursor): string {
  // Keys/identities are ASCII. The complete scope travels with the seek position, so no server-side cursor table is needed.
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function resume(span: Bounds, key: string): string {
  if (key.length > 4096 || key < span.gte || key >= span.lt) return invalidCursor();
  // A valid key can have another key as a prefix (e.g. numeric IDs 1 and 10).
  // At the DBSONL length ceiling extensions are impossible, so the successor of the prefix is safe.
  return key.length < 4096 ? key + '\0' : range(key).lt;
}
function positive(value: number, max: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new RangeError('Invalid index page ' + field + '.');
  return value;
}
function captureRange(options: IndexRangeOptions) {
  const prefix = options.prefix ?? [];
  if (!Array.isArray(prefix) || prefix.length > 16)
    throw new TypeError('prefix must be a dense array of at most 16 ordered values.');
  const bodies: string[] = [];
  for (let i = 0; i < prefix.length; i++) {
    if (!Object.hasOwn(prefix, i)) throw new TypeError('prefix must be a dense array.');
    bodies.push(orderBody(prefix[i]));
  }
  for (const [a, b] of [
    ['lt', 'lte'],
    ['gt', 'gte'],
  ] as const)
    if (Object.hasOwn(options, a) && Object.hasOwn(options, b))
      throw new TypeError('Supply one bound per side.');
  const terms: BoundTerm[] = [];
  for (const op of rangeOps)
    if (Object.hasOwn(options, op)) terms.push({ op, body: orderBody(options[op]) });
  return { bodies, terms };
}
async function resolveRange(
  reader: Reader,
  collection: string,
  indexName: string,
  captured: ReturnType<typeof captureRange>,
) {
  const schema = readSchema((await reader.get(schemaKey(collection))).value);
  const def = schema.indexes.find((index) => index.name === indexName && index.order);
  if (!def)
    throw new DatabaseError('SCHEMA_MISMATCH', 'Ordered index ' + indexName + ' does not exist.');
  return { def, span: orderedSpan(collection, def, captured.bodies, captured.terms) };
}

/** Sessions expose native batched scans. The transaction fallback reads its staged overlay. */
async function* pointerBatches(
  reader: Reader,
  bounds: Bounds,
  limit: number,
  signal?: AbortSignal,
) {
  if (bounds.gte >= bounds.lt) return;
  const options = { ...bounds, limit, signal };
  const batchSize = Math.min(limit, 128);
  if (reader.scanBatches) {
    yield* reader.scanBatches({ ...options, batchSize, maxBatchBytes: 512 * 1024 });
    return;
  }
  let batch: Row<unknown>[] = [];
  for await (const row of reader.scan(options)) {
    batch.push(row);
    if (batch.length === batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

function checkedToken(row: Row<unknown>, end: string): string {
  if (typeof row.value !== 'string' || !row.key.endsWith(end + row.value))
    throw new DatabaseError('CORRUPT', 'Invalid ordered index pointer.');
  return row.value;
}
export async function countIndexRange(
  context: ReadContext,
  collection: string,
  indexName: string,
  options: IndexCountOptions = {},
) {
  context.check();
  name(indexName);
  const captured = captureRange(options);
  const { signal, maxScannedEntries: budget = Number.MAX_SAFE_INTEGER } = options;
  if (!Number.isSafeInteger(budget) || budget < 0)
    throw new RangeError('Invalid maxScannedEntries.');
  signal?.throwIfAborted();
  const lease = await context.open();
  try {
    const { def, span } = await resolveRange(lease.reader, collection, indexName, captured);
    const terminator = def.order!.at(-1) === 'asc' ? '!' : '~';
    let count = 0;
    for await (const batch of pointerBatches(
      lease.reader,
      span,
      Math.min(Number.MAX_SAFE_INTEGER, budget + 1),
      signal,
    )) {
      context.check();
      signal?.throwIfAborted();
      count += batch.length;
      if (count > budget) throw new RangeError('Index count exceeds maxScannedEntries.');
      for (const row of batch) checkedToken(row, terminator);
    }
    context.check();
    signal?.throwIfAborted();
    return count;
  } finally {
    await lease.close();
  }
}

/** One lookahead pointer determines whether a continuation exists for either output shape. */
export function indexPage<T extends Document>(
  context: ReadContext,
  collection: string,
  indexName: string,
  options?: IndexPageOptions,
): Promise<IndexPage<T>>;
export function indexPage<T extends Document>(
  context: ReadContext,
  collection: string,
  indexName: string,
  options: IndexPageOptions | undefined,
  idsOnly: true,
): Promise<IndexPage<T['id']>>;
export async function indexPage<T extends Document>(
  context: ReadContext,
  collection: string,
  indexName: string,
  options: IndexPageOptions = {},
  idsOnly = false,
): Promise<IndexPage<T | T['id']>> {
  context.check();
  name(indexName);
  const limit = positive(options.limit ?? 50, 1000, 'limit');
  const maxBytes = positive(
    options.maxOutputBytes ?? 16 * 1024 * 1024,
    Number.MAX_SAFE_INTEGER,
    'maxOutputBytes',
  );
  const signal = options.signal;
  const check = () => {
    context.check();
    signal?.throwIfAborted();
  };
  check();
  const captured = captureRange(options);
  const after = options.after === undefined ? undefined : parseCursor(options.after);
  const scope = context.cursorIdentity?.();
  if (after && (after[2] !== collection || after[3] !== indexName)) invalidCursor();
  const resumeRevision = after && context.atRevision ? Number(after[6].split('/')[0]) : undefined;
  const lease = await (
    resumeRevision !== undefined ? context.atRevision!(resumeRevision) : context
  ).open();
  try {
    check();
    const reader = lease.reader;
    // The factory has already verified its store UUID. Directly wrapped readers recover it from this snapshot.
    const identity = scope ?? storeIdentity((await reader.get(FORMAT_KEY)).value);
    if (after && after[1] !== identity) invalidCursor();
    const version =
      String(await collectionVersion(reader, collection)) + '/' + (context.cursorMutation?.() ?? 0);
    if (after && after[6] !== version)
      throw new DatabaseError(
        'STALE_CURSOR',
        'Collection changed between pages. Start a new page sequence or use the original snapshot.',
      );
    const { def, span } = await resolveRange(reader, collection, indexName, captured);
    if (after && (after[4] !== span.gte || after[5] !== span.lt)) invalidCursor();
    const gte = after ? resume(span, after[7]) : span.gte;
    const keys: string[] = [],
      pointers: string[] = [];
    const rows: (T | T['id'])[] = [];
    const terminator = def.order!.at(-1) === 'asc' ? '!' : '~';
    const docPrefix = documentPrefix(collection);
    let bytes = 0,
      extra = false,
      lastKey = '',
      seen = 0;
    for await (const batch of pointerBatches(reader, { gte, lt: span.lt }, limit + 1, signal)) {
      check();
      for (const entry of batch) {
        if (seen === limit) {
          extra = true;
          break;
        }
        const token = checkedToken(entry, terminator);
        seen++;
        lastKey = entry.key;
        if (idsOnly) {
          const id = primaryFromToken(token);
          bytes += estimateRowBytes(id);
          if (bytes > maxBytes) throw new RangeError('Index page exceeds maxOutputBytes.');
          rows.push(id);
        } else {
          keys.push(entry.key);
          pointers.push(docPrefix + token);
        }
      }
    }
    for (let i = 0; i < keys.length; i += 8) {
      const found = await readKeys(reader, pointers.slice(i, i + 8), signal);
      for (const [j, item] of found.entries()) {
        const doc = item.value as T | undefined;
        if (
          !doc ||
          docPrefix + primary(doc.id) !== pointers[i + j] ||
          indexKey(collection, def, doc) !== keys[i + j]
        )
          throw new DatabaseError(
            'CORRUPT',
            'Ordered index points to a missing or mismatched document.',
          );
        bytes += estimateRowBytes(doc);
        if (bytes > maxBytes) throw new RangeError('Index page exceeds maxOutputBytes.');
        rows.push(doc);
      }
    }
    check();
    const nextCursor = extra
      ? encodeCursor([1, identity, collection, indexName, span.gte, span.lt, version, lastKey])
      : null;
    return { rows, revision: reader.revision, nextCursor };
  } finally {
    await lease.close();
  }
}
