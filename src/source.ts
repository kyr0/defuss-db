import {
  orderedAccess,
  rangeOps,
  type Inequality,
  type AccessSelection,
  type Bounds,
} from './ordered-access.js';
import { compileQuery } from 'defuss-dataview/query';
import { createDbsonlSource } from 'defuss-dataview/adapters/dbsonl';
import { batchRows } from 'defuss-dataview/stream';
import type { RecordSource, ScanRequest } from 'defuss-dataview/stream';
import type { Row } from 'defuss-dbsonl';
import { settleReads } from './reads.js';
import { sourceMeasure } from './measured.js';
import { poolBatches, spans } from './batches.js';
import type { BatchReader } from './batches.js';
import { DatabaseError } from './errors.js';
import {
  documentKey,
  documentPrefix,
  indexValuePrefix,
  primary,
  range,
  readSchema,
  schemaKey,
  tuple,
} from './keys.js';
import type {
  AccessPlan,
  Document,
  IndexDefinition,
  Reader,
  ReadContext,
  Selection,
} from './types.js';

export type StoredRow<T extends Document> = Row<T>;
type Plan = {
  public: AccessPlan;
  key?: string;
  index?: IndexDefinition;
  prefix?: string;
  bounds?: Bounds;
  keys?: string[];
};
/** Pick a physical access path while preserving the DataView result order. Every candidate still passes the full predicate. */
export async function planAccess(
  reader: Reader,
  collection: string,
  selection: AccessSelection,
  signal?: ScanRequest<StoredRow<Document>>['signal'],
): Promise<Plan> {
  const plan = await choose(reader, collection, selection, signal);
  // A historical equality index may leave out a past version whose key would exceed the limit; the chosen one is
  // checked here, after the ordered candidates, so a view never materializes an index it does not use.
  // VERIFIED: tests/history.test.ts 'key limit' (a compound key that fits as an operand, not with a 450-unit ID).
  if (plan.index && !plan.index.order && reader.indexComplete && !(await reader.indexComplete(plan.index)))
    return { public: { kind: 'scan' } };
  return plan;
}
async function choose(
  reader: Reader,
  collection: string,
  selection: AccessSelection,
  signal?: ScanRequest<StoredRow<Document>>['signal'],
): Promise<Plan> {
  if (selection.access !== undefined && selection.access !== 'auto' && selection.access !== 'scan')
    throw new TypeError('access must be auto or scan.');
  if (selection.access === 'scan') return { public: { kind: 'scan' } };
  const equals = new Map(
    (selection.filters ?? [])
      .filter((filter) => filter.op === 'eq')
      .map((filter) => [filter.field, filter.value]),
  );
  if (equals.has('id')) {
    try {
      return {
        public: { kind: 'primary' },
        key: documentKey(collection, equals.get('id') as Document['id']),
      };
    } catch {
      /* Invalid IDs are still valid query operands; a scan proves their result. */
    }
  }
  const members = selection.filters?.find(
    (filter) =>
      filter.field === 'id' &&
      filter.op === 'in' &&
      Array.isArray(filter.value) &&
      filter.value.length <= 256,
  )?.value;
  if (Array.isArray(members)) {
    const keys = new Set<string>();
    for (const value of members) {
      try {
        keys.add(documentKey(collection, value));
      } catch {
        /* Values outside the primary-key domain cannot match. */
      }
    }
    return { public: { kind: 'primary-in', pointKeys: keys.size }, keys: [...keys].sort() };
  }
  if (
    (!equals.size &&
      !selection.sorters?.length &&
      !selection.filters?.some((f) => rangeOps.includes(f.op as Inequality))) ||
    selection.semantics?.equality === 'identity'
  )
    return { public: { kind: 'scan' } };
  const stored = await reader.get(schemaKey(collection));
  const schema = readSchema(stored.value);
  const definitions = reader.temporal
    ? schema.indexes.map((i) => (i.unique ? { ...i, unique: false } : i))
    : schema.indexes;
  const eligible = definitions
    .filter((index) => !index.order && index.fields.every((field) => equals.has(field)))
    .sort((a, b) => Number(b.unique) - Number(a.unique) || b.fields.length - a.fields.length);
  let fallback: Plan = { public: { kind: 'scan' } };
  for (const index of eligible) {
    try {
      const prefix = indexValuePrefix(
        collection,
        index,
        tuple(index.fields.map((field) => equals.get(field))),
      );
      fallback = {
        public: { kind: 'equality', index: index.name, unique: index.unique },
        prefix,
        index,
      };
      if (index.unique) return fallback;
      break;
    } catch (error) {
      if (
        !(error instanceof RangeError) &&
        !(error instanceof DatabaseError && error.code === 'INVALID_INDEX_VALUE')
      )
        throw error;
    }
  }
  let indexes = schema.indexes,
    ordered = orderedAccess(collection, indexes, selection, equals);
  // A historical view keys past versions with today's ordered indexes; one that cannot key a visible version would
  // leave it out of ranges and sorts, so the next best index or a scan answers instead.
  while (ordered && reader.indexComplete && !(await reader.indexComplete(ordered.index))) {
    const skipped = ordered.index;
    indexes = indexes.filter((index) => index !== skipped);
    ordered = orderedAccess(collection, indexes, selection, equals);
  }
  if (!ordered) return fallback;
  const info = {
    index: ordered.index.name,
    equalityPrefix: ordered.equalityPrefix,
    ...(ordered.rangeField ? { rangeField: ordered.rangeField } : {}),
  };
  if (ordered.direct)
    return { public: { kind: 'ordered', ...info }, index: ordered.index, bounds: ordered.bounds };
  if (
    fallback.index &&
    !ordered.rangeField &&
    fallback.index.fields.length >= ordered.equalityPrefix
  )
    return fallback;
  // A narrow unsorted range can be restored to natural primary-key order cheaply. Probe one extra
  // pointer to bound both memory and speculative I/O before fetching any documents.
  const keys: string[] = [];
  for await (const item of reader.scan({ ...ordered.bounds, limit: 129, signal })) {
    if (keys.length === 128) return fallback;
    if (typeof item.value !== 'string')
      throw new DatabaseError('CORRUPT', 'Invalid ordered index pointer.');
    keys.push(documentPrefix(collection) + item.value);
  }
  return {
    public: { kind: 'range', ...info, pointKeys: keys.length },
    index: ordered.index,
    keys: keys.sort(),
  };
}
function typed<T extends Document>(row: Row<unknown>): StoredRow<T> {
  return row as StoredRow<T>;
}
async function* candidates<T extends Document>(
  reader: Reader,
  collection: string,
  plan: Plan,
  request: ScanRequest<StoredRow<T>>,
  concurrency = 8,
): AsyncGenerator<StoredRow<T>> {
  if (plan.keys) {
    // Merge typed IDs in natural document-key order. This preserves scan order for ties, grouping and sums.
    for (let i = 0; i < plan.keys.length; i += concurrency) {
      if (request.signal?.aborted) throw request.signal.reason ?? new Error('Aborted');
      const keys = plan.keys.slice(i, i + concurrency);
      const rows = await settleReads(keys.map((key) => reader.get(key)));
      for (const [j, item] of rows.entries()) {
        if (
          plan.index &&
          (!item.found || !item.value || documentKey(collection, (item.value as T).id) !== keys[j])
        )
          throw new DatabaseError(
            'CORRUPT',
            'Ordered index points to a missing or mismatched document.',
          );
        if (item.found) yield { key: keys[j]!, value: item.value as T, revision: item.revision };
      }
    }
    return;
  }
  if (plan.key) {
    const item = await reader.get(plan.key);
    if (item.found) yield { key: plan.key, value: item.value as T, revision: item.revision };
    return;
  }
  const resolve = async (token: unknown): Promise<StoredRow<T>> => {
    if (typeof token !== 'string') throw new DatabaseError('CORRUPT', 'Invalid index pointer.');
    const key = documentPrefix(collection) + token,
      found = await reader.get(key);
    if (!found.found || !found.value || primary((found.value as Document).id) !== token)
      throw new DatabaseError('CORRUPT', 'Index points to a missing or mismatched document.');
    return { key, value: found.value as T, revision: found.revision };
  };
  if (plan.index?.unique) {
    const item = await reader.get(plan.prefix!);
    if (item.found) yield await resolve(item.value);
  } else if (plan.index) {
    let tokens: unknown[] = [];
    for await (const item of reader.scan({
      ...(plan.bounds ?? range(plan.prefix!)),
      signal: request.signal,
    })) {
      if (concurrency === 1) {
        yield await resolve(item.value);
        continue;
      }
      tokens.push(item.value);
      if (tokens.length === concurrency) {
        if (request.signal?.aborted) throw request.signal.reason ?? new Error('Aborted');
        yield* await settleReads(tokens.map(resolve));
        tokens = [];
      }
    }
    if (tokens.length) yield* await settleReads(tokens.map(resolve));
  } else {
    for await (const row of reader.scan({
      ...range(documentPrefix(collection)),
      signal: request.signal,
    }))
      yield typed<T>(row);
  }
}
/** All candidates, schema and index pointers belong to one immutable storage revision. */
export function createSource<T extends Document>(
  context: ReadContext,
  collection: string,
  selection: AccessSelection = {},
): RecordSource<StoredRow<T>> {
  return {
    async open({ signal } = {}) {
      context.check();
      if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
      const lease = await context.open();
      let closed = false;
      try {
        const plan = await planAccess(lease.reader, collection, selection, signal);
        if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
        if (plan.public.kind === 'scan') {
          // Preserve DataView's registered measured-batch capability: return its session unchanged.
          // The official adapter measures each emitted row once and uses DBSONL's native batch scan.
          const reader = lease.reader;
          return await createDbsonlSource<T>(
            {
              beginRead: async () => ({
                revision: reader.revision,
                count: 0, // ignored: the source always has explicit key bounds
                get: (key) =>
                  reader.get(key) as Promise<{ found: boolean; value?: T; revision?: number }>,
                scan: (input) => reader.scan(input) as AsyncIterable<StoredRow<T>>,
                ...(reader.scanBatches
                  ? {
                      scanBatches: (input: Parameters<NonNullable<Reader['scanBatches']>>[0]) =>
                        reader.scanBatches!(input) as AsyncIterable<readonly StoredRow<T>[]>,
                    }
                  : {}),
                close: () => lease.close(),
              }),
            },
            range(documentPrefix(collection)),
          ).open({ signal });
        }
        return {
          ...(plan.public.kind === 'ordered' && selection.sorters?.length
            ? {
                ordering: compileQuery({
                  sorters: selection.sorters.map((s) => ({ ...s, field: 'value.' + s.field })),
                }).ordering,
              }
            : {}),
          consistency: 'snapshot' as const,
          revision: lease.reader.revision,
          // Total DB entry count includes metadata and other collections. Never advertise it here.
          async *scan(request: ScanRequest<StoredRow<T>>) {
            context.check();
            if (closed) throw new DatabaseError('CLOSED', 'Query session is closed.');
            yield* batchRows(
              candidates<T>(lease.reader, collection, plan, request, context.lookupConcurrency),
              plan.bounds ? { ...request, batchSize: Math.min(16, request.batchSize) } : request,
            );
          },
          async close() {
            if (!closed) {
              closed = true;
              await lease.close();
            }
          },
        };
      } catch (error) {
        await lease.close();
        throw error;
      }
    },
  };
}
/** Public source exposes documents directly for arbitrary user-authored DataView plans. */
export function documentSource<T extends Document>(
  source: RecordSource<StoredRow<T>>,
): RecordSource<T> {
  return {
    async open(options) {
      const session = await source.open(options);
      return {
        consistency: session.consistency,
        revision: session.revision,
        async *scan(request) {
          for await (const rows of session.scan({
            ...request,
            sizeOf: (row) => request.sizeOf(row.value),
          }))
            yield rows.map((row) => row.value);
        },
        close: () => session.close(),
      };
    },
  };
}

/** Document plans compile once. Native batches avoid the row-at-a-time public adapter fallback. */
export function createDocumentSource<T extends Document>(
  context: ReadContext,
  collection: string,
  selection: AccessSelection = {},
): RecordSource<T> {
  return {
    async open({ signal } = {}) {
      context.check();
      if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
      const lease = await context.open();
      let closed = false;
      const close = async () => {
        if (!closed) {
          closed = true;
          await lease.close();
        }
      };
      try {
        const plan = await planAccess(lease.reader, collection, selection, signal);
        return {
          ...(plan.public.kind === 'ordered' && selection.sorters?.length
            ? {
                ordering: compileQuery({ sorters: selection.sorters }).ordering,
              }
            : {}),
          revision: lease.reader.revision,
          consistency: 'snapshot' as const,
          async *scan(request: ScanRequest<T>) {
            context.check();
            if (closed) throw new DatabaseError('CLOSED', 'Query session is closed.');
            // VERIFIED: DataView measures each yielded row again; the queue answers that call from this measurement.
            const measure = sourceMeasure(request.sizeOf);
            if (plan.public.kind === 'scan' && lease.reader.scanBatches) {
              // Each row is measured once here; batches over the budget leave as several spans.
              const value = (row: Row<unknown>) => measure(row.value as T);
              for await (const batch of poolBatches(lease.reader as BatchReader, {
                ...range(documentPrefix(collection)),
                signal: request.signal,
                batchSize: request.batchSize,
              }))
                for (const span of spans(batch, value, request.maxBatchBytes))
                  yield span.map((row) => row.value as T);
            } else {
              const input = {
                ...request,
                sizeOf: (row: StoredRow<T>) => measure(row.value),
              };
              for await (const batch of batchRows(
                candidates<T>(lease.reader, collection, plan, input, context.lookupConcurrency),
                plan.bounds ? { ...input, batchSize: Math.min(16, input.batchSize) } : input,
              ))
                yield batch.map((row) => row.value);
            }
          },
          close,
        };
      } catch (error) {
        await close();
        throw error;
      }
    },
  };
}

export function capturedSelection(selection: Selection): AccessSelection {
  // compileQuery validates/captures filtering, but does not expose operands. Copy the same mutable value domain here.
  const copy = (value: unknown): unknown =>
    value instanceof Date
      ? new Date(value.getTime())
      : value instanceof ArrayBuffer
        ? value.slice(0)
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice()
          : value;
  return {
    access: selection.access,
    semantics: selection.semantics && { ...selection.semantics },
    filters: selection.filters?.map((filter) => ({
      ...filter,
      value:
        filter.op === 'in' && Array.isArray(filter.value)
          ? filter.value.map((v) => (selection.semantics?.equality === 'identity' ? v : copy(v)))
          : selection.semantics?.equality === 'identity'
            ? filter.value
            : copy(filter.value),
    })),
  };
}
