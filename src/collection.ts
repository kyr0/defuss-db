import { point, validateWriteTime } from './history-store.js';
import { transactionSchema } from './schema-cache.js';
import { timeScope, type TimeScope, type HistoryWriteOptions } from './history-types.js';
import { encode, decode } from 'defuss-dson/binary';
import { DEFAULT_OPTIONS, DbsonlError } from 'defuss-dbsonl';
import { DatabaseError } from './errors.js';
import { capture, captureDocument, documentKey, name, normalizeIndex, primary } from './keys.js';
import {
  createIndex,
  deleteDocument,
  dropIndex,
  putDocument,
  previousDocument,
} from './mutations.js';
import { createSearchIndex, dropSearchIndex } from './search-mutations.js';
import { normalizeSearchIndex } from './search-config.js';
import type { SearchIndexDefinition } from './search-types.js';
import { ReadCollection } from './query.js';
import { TransactionScope } from './scope.js';
import type {
  Document,
  FindRequest,
  IndexDefinition,
  MutationLimits,
  NewDocument,
  PrimaryKey,
  ReadContext,
  QueryOptions,
  TransactionResult,
  Updater,
  WriteOptions,
  Writer,
} from './types.js';

function copyUpdater<T extends Document>(updater: Updater<T>, limits: MutationLimits): Updater<T> {
  if (typeof updater === 'function') return updater;
  if (
    !updater ||
    typeof updater !== 'object' ||
    Array.isArray(updater) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(updater))
  )
    throw new TypeError('An update must be a plain patch object or a callback.');
  if (Object.hasOwn(updater, 'id'))
    throw new DatabaseError(
      'INVALID_DOCUMENT',
      'Patches cannot change id; use put() to replace a document.',
    );
  return capture(updater, limits);
}
async function updated<T extends Document>(
  current: T,
  updater: Updater<T>,
  limits: MutationLimits,
): Promise<T> {
  const originalId = primary(current.id);
  let value: T;
  if (typeof updater === 'function') value = await updater(current);
  else {
    for (const key of Object.keys(updater))
      Object.defineProperty(current, key, {
        value: (updater as Record<string, unknown>)[key],
        enumerable: true,
        writable: true,
        configurable: true,
      });
    value = current;
  }
  const result = captureDocument<T>(value, limits, false);
  if (primary(result.id) !== originalId)
    throw new DatabaseError('INVALID_DOCUMENT', 'An update callback cannot change id.');
  return result;
}
function captureMany<T extends Document>(
  input: readonly NewDocument<T>[],
  limits: MutationLimits,
): T[] {
  if (!Array.isArray(input) || input.length > limits.maxTransactionOperations)
    throw new DbsonlError('LIMIT_EXCEEDED', 'Too many documents in one atomic insertMany.');
  let bytes = 0;
  return input.map((value) => {
    const encoded = encode(value, { maxRecordBytes: limits.maxRecordBytes });
    if ((bytes += encoded.byteLength + 128) > limits.maxTransactionBytes)
      throw new DbsonlError('LIMIT_EXCEEDED', 'insertMany exceeds its encoded-byte budget.');
    const row = decode(encoded) as T;
    // generate an id after capture, preserving a self-reference to the decoded root.
    if (
      row &&
      typeof row === 'object' &&
      !Array.isArray(row) &&
      (!Object.hasOwn(row, 'id') || row.id === undefined)
    )
      Object.defineProperty(row, 'id', {
        value: globalThis.crypto.randomUUID(),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    // The single-document path validates without retaining another input copy.
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(row))
    )
      throw new DatabaseError('INVALID_DOCUMENT', 'A document must be a plain object.');
    primary(row.id);
    return row;
  });
}
function writeScope(input?: HistoryWriteOptions, bound?: TimeScope) {
  const scope = timeScope(input, bound);
  if (scope?.cutoff !== undefined)
    throw new DatabaseError('HISTORY_READ_ONLY', 'Writes require current recorded knowledge.');
  return scope;
}
function bulkOptions<T extends Document>(input?: QueryOptions<T> & HistoryWriteOptions) {
  if (!input) return;
  const { $historic: _effective, $until: _end, $asOfRevision: _recorded, ...options } = input;
  return options;
}
function currentDDL(period?: TimeScope, options?: HistoryWriteOptions) {
  if (period || timeScope(options))
    throw new DatabaseError('HISTORY_READ_ONLY', 'Schema changes require the live collection.');
}
const capturedUpdate = Symbol('capturedUpdate');
const capturedModifyMany = Symbol('capturedModifyMany');
const capturedWrite = Symbol('capturedWrite');
export class TransactionCollection<T extends Document = Document> extends ReadCollection<T> {
  constructor(
    collection: string,
    context: ReadContext,
    private readonly tx: Writer,
    private readonly scope: TransactionScope,
    private readonly limits: MutationLimits,
    period?: TimeScope,
  ) {
    super(collection, context, period);
  }
  override at(
    date: Date,
    options?: { $until?: Date; $asOfRevision?: undefined },
  ): TransactionCollection<T>;
  override at(date: Date, options: Omit<HistoryWriteOptions, '$historic'>): ReadCollection<T>;
  override at(
    date: Date,
    options: Omit<HistoryWriteOptions, '$historic'> = {},
  ): TransactionCollection<T> {
    return new TransactionCollection(
      this.name,
      this.rawContext,
      this.tx,
      this.scope,
      this.limits,
      timeScope({ ...options, $historic: date }, this.period),
    );
  }
  insert(value: NewDocument<T>, options?: HistoryWriteOptions): Promise<PrimaryKey> {
    const row = captureDocument<T>(value, this.limits, true);
    return this[capturedWrite]([row], true, writeScope(options, this.period)).then(
      (ids) => ids[0]!,
    );
  }
  insertMany(
    values: readonly NewDocument<T>[],
    options?: HistoryWriteOptions,
  ): Promise<PrimaryKey[]> {
    const rows = captureMany(values, this.limits);
    return this[capturedWrite](rows, true, writeScope(options, this.period));
  }
  /** Replace or insert a whole document. No merge; use update() for shallow patches. */
  put(value: T, options?: HistoryWriteOptions): Promise<PrimaryKey> {
    const row = captureDocument<T>(value, this.limits, false);
    return this[capturedWrite]([row], false, writeScope(options, this.period)).then(
      (ids) => ids[0]!,
    );
  }
  /** Internal ownership transfer: all rows were captured synchronously by the public caller. */
  [capturedWrite](
    rows: readonly T[],
    insertOnly: boolean,
    period = this.period,
  ): Promise<PrimaryKey[]> {
    return this.scope.run(true, async () => {
      for (const row of rows)
        await putDocument(this.tx, this.name, row, insertOnly, undefined, period);
      return rows.map((row) => row.id);
    });
  }
  update(id: PrimaryKey, updater: Updater<T>, options?: HistoryWriteOptions): Promise<boolean> {
    return this[capturedUpdate](
      id,
      copyUpdater(updater, this.limits),
      writeScope(options, this.period),
    );
  }
  [capturedUpdate](id: PrimaryKey, copy: Updater<T>, period = this.period): Promise<boolean> {
    const key = documentKey(this.name, id);
    return this.scope.run(true, async () => {
      if (period) {
        const schema = (await transactionSchema(this.tx, this.name)).schema;
        await validateWriteTime(this.tx, schema, period);
      }
      const old = period
        ? await point(this.tx, this.name, primary(id), period.time)
        : await this.tx.get(key);
      if (!old.found) return false;
      const previous = period
        ? undefined
        : await previousDocument(
            this.tx,
            this.name,
            old.value as T,
            typeof copy === 'function' ? undefined : copy,
          );
      await putDocument(
        this.tx,
        this.name,
        await updated(old.value as T, copy, this.limits),
        false,
        previous,
        period,
      );
      return true;
    });
  }
  delete(id: PrimaryKey, options?: HistoryWriteOptions): Promise<boolean> {
    primary(id);
    const period = writeScope(options, this.period);
    return this.scope.run(true, () => deleteDocument(this.tx, this.name, id, period));
  }
  /** The whole update is atomic; exceeding transaction/query budgets rejects it without partial publication. */
  updateMany(
    request: FindRequest,
    updater: Updater<T>,
    options?: QueryOptions<T> & HistoryWriteOptions,
  ): Promise<number> {
    return this[capturedModifyMany](request, copyUpdater(updater, this.limits), options);
  }
  [capturedModifyMany](
    request: FindRequest,
    copy: Updater<T>,
    options?: QueryOptions<T> & HistoryWriteOptions,
  ): Promise<number> {
    return this.modifyMany(request, copy, options);
  }
  deleteMany(
    request: FindRequest = {},
    options?: QueryOptions<T> & HistoryWriteOptions,
  ): Promise<number> {
    return this.modifyMany(request, undefined, options);
  }
  private modifyMany(
    request: FindRequest,
    updater?: Updater<T>,
    options?: QueryOptions<T> & HistoryWriteOptions,
  ): Promise<number> {
    // Querying the same transaction privately avoids re-entering its public sequential-operation guard.
    const period = writeScope(options, writeScope(request, this.period));
    const internal = new ReadCollection<T>(
      this.name,
      {
        check: () => this.scope.check(),
        get: (key) => this.tx.get(key),
        open: async () => ({ reader: this.tx, close: async () => {} }),
      },
      period,
    );
    // Collect IDs/rows before changing an index the candidate iterator may be traversing.
    const { $historic: _t, $asOfRevision: _r, ...selection } = request;
    const prepared = internal.prepareFind(selection);
    return this.scope.run(true, async () => {
      if (period)
        await validateWriteTime(
          this.tx,
          (await transactionSchema(this.tx, this.name)).schema,
          period,
        );
      const result = await prepared.evaluate(undefined, {
        ...bulkOptions(options),
        maxOutputRows: Math.min(
          options?.maxOutputRows ?? this.limits.maxTransactionOperations,
          this.limits.maxTransactionOperations,
        ),
        maxOutputBytes: Math.min(
          options?.maxOutputBytes ?? this.limits.maxTransactionBytes,
          this.limits.maxTransactionBytes,
        ),
      });
      for (const row of result.rows) {
        if (updater) {
          const previous = period
            ? undefined
            : await previousDocument(
                this.tx,
                this.name,
                row,
                typeof updater === 'function' ? undefined : updater,
              );
          await putDocument(
            this.tx,
            this.name,
            await updated(row, updater, this.limits),
            false,
            previous,
            period,
          );
        } else await deleteDocument(this.tx, this.name, row.id, period);
      }
      return result.rows.length;
    });
  }
  createSearchIndex(index: SearchIndexDefinition): Promise<void> {
    currentDDL(this.period);
    const copy = normalizeSearchIndex(index);
    return this.scope.run(true, () => createSearchIndex(this.tx, this.name, copy));
  }
  dropSearchIndex(indexName: string): Promise<boolean> {
    currentDDL(this.period);
    name(indexName);
    return this.scope.run(true, () => dropSearchIndex(this.tx, this.name, indexName));
  }
  createIndex(index: IndexDefinition): Promise<void> {
    currentDDL(this.period);
    const copy = normalizeIndex(index);
    return this.scope.run(true, () => createIndex(this.tx, this.name, copy));
  }
  dropIndex(indexName: string): Promise<boolean> {
    currentDDL(this.period);
    name(indexName);
    return this.scope.run(true, () => dropIndex(this.tx, this.name, indexName));
  }
}
export interface TransactionHost {
  transaction<R>(
    callback: (tx: {
      collection<T extends Document>(name: string): TransactionCollection<T>;
    }) => Promise<R> | R,
    options?: WriteOptions,
  ): Promise<TransactionResult<R>>;
}
/** Live collection writes use one implicit transaction; explicit transactions reuse the same implementation. */
export class Collection<T extends Document = Document> extends ReadCollection<T> {
  constructor(
    collection: string,
    context: ReadContext,
    private readonly host: TransactionHost,
    private readonly limits: MutationLimits = DEFAULT_OPTIONS,
    period?: TimeScope,
  ) {
    super(collection, context, period);
  }
  override at(date: Date, options?: { $until?: Date; $asOfRevision?: undefined }): Collection<T>;
  override at(date: Date, options: Omit<HistoryWriteOptions, '$historic'>): ReadCollection<T>;
  override at(date: Date, options: Omit<HistoryWriteOptions, '$historic'> = {}): Collection<T> {
    return new Collection(
      this.name,
      this.rawContext,
      this.host,
      this.limits,
      timeScope({ ...options, $historic: date }, this.period),
    );
  }
  private async write<R>(
    fn: (collection: TransactionCollection<T>) => Promise<R>,
    options?: WriteOptions,
  ): Promise<R> {
    const period = writeScope(options, this.period);
    return (
      await this.host.transaction((tx) => {
        const collection = tx.collection<T>(this.name);
        return fn(
          period
            ? collection.at(
                new Date(period.time),
                period.until === undefined ? {} : { $until: new Date(period.until) },
              )
            : collection,
        );
      }, options)
    ).result;
  }
  insert(value: NewDocument<T>, options?: WriteOptions): Promise<PrimaryKey> {
    const copy = captureDocument<T>(value, this.limits, true);
    return this.write((tx) => tx[capturedWrite]([copy], true).then((ids) => ids[0]!), options);
  }
  insertMany(values: readonly NewDocument<T>[], options?: WriteOptions): Promise<PrimaryKey[]> {
    const copies = captureMany(values, this.limits);
    return this.write((tx) => tx[capturedWrite](copies, true), options);
  }
  /** Pull-driven ingestion. Each input batch commits atomically; prior receipts remain committed if a later batch fails. */
  insertBatches(
    batches: AsyncIterable<readonly NewDocument<T>[]> | Iterable<readonly NewDocument<T>[]>,
    options?: WriteOptions,
  ): AsyncGenerator<{ ids: PrimaryKey[]; revision: number; storedEntries: number }> {
    const period = writeScope(options, this.period);
    const {
      $historic: _time,
      $asOfRevision: _cut,
      $until: _until,
      ...commitOptions
    } = options ?? {};
    const { host, name, limits } = this;
    return (async function* () {
      for await (const batch of batches) {
        if (commitOptions.signal?.aborted) throw new DbsonlError('ABORTED', 'Import cancelled.');
        const captured = captureMany(batch, limits);
        const { result: ids, ...receipt } = await host.transaction(
          (tx) => tx.collection<T>(name)[capturedWrite](captured, true, period),
          commitOptions,
        );
        yield { ids, ...receipt };
      }
    })();
  }
  put(value: T, options?: WriteOptions): Promise<PrimaryKey> {
    const copy = captureDocument<T>(value, this.limits, false);
    return this.write((tx) => tx[capturedWrite]([copy], false).then((ids) => ids[0]!), options);
  }
  update(id: PrimaryKey, updater: Updater<T>, options?: WriteOptions): Promise<boolean> {
    const copy = copyUpdater(updater, this.limits);
    return this.write((tx) => tx[capturedUpdate](id, copy), options);
  }
  delete(id: PrimaryKey, options?: WriteOptions): Promise<boolean> {
    primary(id);
    return this.write((tx) => tx.delete(id), options);
  }
  updateMany(
    request: FindRequest,
    updater: Updater<T>,
    options?: WriteOptions & QueryOptions<T>,
  ): Promise<number> {
    const copy = copyUpdater(updater, this.limits);
    // Capture the query before waiting for a transaction; opaque identity operands retain their identity by design.
    const stable = capture(request, this.limits);
    const execOptions = bulkOptions(options);
    return this.write((tx) => tx[capturedModifyMany](stable, copy, execOptions), options);
  }
  deleteMany(request: FindRequest = {}, options?: WriteOptions & QueryOptions<T>): Promise<number> {
    const stable = capture(request, this.limits);
    const execOptions = bulkOptions(options);
    return this.write((tx) => tx.deleteMany(stable, execOptions), options);
  }
  createSearchIndex(index: SearchIndexDefinition, options?: WriteOptions): Promise<void> {
    currentDDL(this.period, options);
    const copy = normalizeSearchIndex(index);
    return this.write((tx) => tx.createSearchIndex(copy), options);
  }
  dropSearchIndex(indexName: string, options?: WriteOptions): Promise<boolean> {
    currentDDL(this.period, options);
    name(indexName);
    return this.write((tx) => tx.dropSearchIndex(indexName), options);
  }
  createIndex(index: IndexDefinition, options?: WriteOptions): Promise<void> {
    currentDDL(this.period, options);
    const copy = normalizeIndex(index);
    return this.write((tx) => tx.createIndex(copy), options);
  }
  dropIndex(indexName: string, options?: WriteOptions): Promise<boolean> {
    currentDDL(this.period, options);
    name(indexName);
    return this.write((tx) => tx.dropIndex(indexName), options);
  }
}
