import { checkCoverage, deletedVersion, point, validateWriteTime } from './history-store.js';
import {
  applyPlans,
  liveOnly,
  planId,
  prunePages,
  prunePlan,
  type IdPlan,
  type PruneHistoryOptions,
  type PruneOptions,
  type PrunePlan,
  type PruneResult,
} from './history-prune.js';
import { transactionSchema } from './schema-cache.js';
import { timeScope, type TimeScope, type HistoryWriteOptions } from './history-types.js';
import { encode, decode } from 'defuss-dson/binary';
import { DEFAULT_OPTIONS, DbsonlError } from 'defuss-dbsonl';
import { DatabaseError } from './errors.js';
import {
  capture,
  captureDocument,
  documentKey,
  name,
  normalizeIndex,
  primary,
  readSchema,
  schemaKey,
} from './keys.js';
import {
  createIndex,
  deleteDocument,
  dropIndex,
  putDocument,
  previousDocument,
  UPDATED_AT,
} from './mutations.js';
import { createSearchIndex, dropSearchIndex } from './search-mutations.js';
import { setSchema } from './catalog.js';
import type { JsonSchema } from './json-schema.js';
import { checkedLimit, checkSchema, type CollectionValidation } from './validate.js';
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
  Replacement,
  QueryOptions,
  TransactionResult,
  Updater,
  DocumentWriteOptions,
  ValidationOptions,
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
function bulkOptions<T extends Document>(input?: QueryOptions<T> & StoreOptions) {
  if (!input) return;
  const {
    $historic: _effective,
    $until: _end,
    $asOfRevision: _recorded,
    validate: _validate,
    ...options
  } = input;
  return options;
}
/** The options of a write that stores documents inside a transaction. */
type StoreOptions = HistoryWriteOptions & ValidationOptions;
/** Whether a write checks its documents against the collection's schema: yes unless `validate: false`. */
function validated(options?: ValidationOptions): boolean {
  const validate = options?.validate;
  if (validate !== undefined && typeof validate !== 'boolean')
    throw new TypeError('validate must be boolean.');
  return validate !== false;
}
function currentDDL(period?: TimeScope, options?: HistoryWriteOptions) {
  if (period || timeScope(options))
    throw new DatabaseError('HISTORY_READ_ONLY', 'Schema changes require the live collection.');
}
/** A caller's schema as an own copy that validateValue enforces in full, or null to remove the schema. */
function copySchema(schema: JsonSchema | null, limits: MutationLimits): JsonSchema | null {
  if (schema === null) return null;
  if (schema === undefined) throw new TypeError('setSchema takes a JSON Schema or null.');
  const copy = capture(schema, limits);
  checkSchema(copy);
  return copy;
}
const capturedUpdate = Symbol('capturedUpdate');
const capturedModifyMany = Symbol('capturedModifyMany');
const capturedWrite = Symbol('capturedWrite');
const prunedStep = Symbol('prunedStep');
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
  insert(value: NewDocument<T>, options?: StoreOptions): Promise<PrimaryKey> {
    const row = captureDocument<T>(value, this.limits, true);
    return this[capturedWrite](
      [row],
      true,
      writeScope(options, this.period),
      validated(options),
    ).then((ids) => ids[0]!);
  }
  insertMany(values: readonly NewDocument<T>[], options?: StoreOptions): Promise<PrimaryKey[]> {
    const rows = captureMany(values, this.limits);
    return this[capturedWrite](rows, true, writeScope(options, this.period), validated(options));
  }
  /** Replace or insert a whole document. No merge; use update() for shallow patches. */
  put(value: Replacement<T>, options?: StoreOptions): Promise<PrimaryKey> {
    const row = captureDocument<T>(value as T, this.limits, false);
    return this[capturedWrite](
      [row],
      false,
      writeScope(options, this.period),
      validated(options),
    ).then((ids) => ids[0]!);
  }
  /** Internal ownership transfer: all rows were captured synchronously by the public caller. */
  [capturedWrite](
    rows: readonly T[],
    insertOnly: boolean,
    period = this.period,
    validate = true,
  ): Promise<PrimaryKey[]> {
    return this.scope.run(true, async () => {
      for (const row of rows)
        await putDocument(
          this.tx,
          this.name,
          row,
          insertOnly,
          undefined,
          period,
          'write',
          validate,
        );
      return rows.map((row) => row.id);
    });
  }
  update(id: PrimaryKey, updater: Updater<T>, options?: StoreOptions): Promise<boolean> {
    return this[capturedUpdate](
      id,
      copyUpdater(updater, this.limits),
      writeScope(options, this.period),
      validated(options),
    );
  }
  [capturedUpdate](
    id: PrimaryKey,
    copy: Updater<T>,
    period = this.period,
    validate = true,
  ): Promise<boolean> {
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
        'write',
        validate,
      );
      return true;
    });
  }
  delete(id: PrimaryKey, options?: HistoryWriteOptions): Promise<boolean> {
    primary(id);
    const period = writeScope(options, this.period);
    return this.scope.run(true, () => deleteDocument(this.tx, this.name, id, period));
  }
  /**
   * Tracked collections: writes back the version a current delete removed, as a new version. Its `_createdAt` stays;
   * `_updatedAt` is the restore. Returns false when the document is live or was never deleted. The version is
   * checked against the collection's schema like any write; `validate: false` restores one that predates the schema.
   * VERIFIED: tests/timestamps.test.ts restores after a same-millisecond insert and delete, and after a full-history
   * archive import; tests/schema-validation.test.ts restores a violating version with `validate: false` only.
   */
  restore(id: PrimaryKey, options?: ValidationOptions): Promise<boolean> {
    const token = primary(id),
      validate = validated(options);
    if (this.period)
      throw new DatabaseError('HISTORY_READ_ONLY', 'restore() writes the current version.');
    return this.scope.run(true, async () => {
      const { schema } = await transactionSchema(this.tx, this.name);
      if (!schema.history)
        throw new DatabaseError('HISTORY_NOT_ENABLED', 'restore() needs a tracked collection.');
      if ((await this.tx.get(documentKey(this.name, id))).found) return false;
      const deleted = await deletedVersion(this.tx, this.name, token);
      if (!deleted) return false;
      // A timestamped collection stamps the restore; elsewhere _updatedAt is the caller's own field.
      const { [UPDATED_AT]: _updated, ...stripped } = deleted.document as unknown as Record<
        string,
        unknown
      >;
      const image = schema.timestamps ? stripped : deleted.document;
      await putDocument(
        this.tx,
        this.name,
        image as unknown as T,
        true,
        undefined,
        undefined,
        'keep',
        validate,
      );
      return true;
    });
  }
  /** The whole update is atomic; exceeding transaction/query budgets rejects it without partial publication. */
  updateMany(
    request: FindRequest,
    updater: Updater<T>,
    options?: QueryOptions<T> & StoreOptions,
  ): Promise<number> {
    return this[capturedModifyMany](request, copyUpdater(updater, this.limits), options);
  }
  [capturedModifyMany](
    request: FindRequest,
    copy: Updater<T>,
    options?: QueryOptions<T> & StoreOptions,
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
    options?: QueryOptions<T> & StoreOptions,
  ): Promise<number> {
    // Querying the same transaction privately avoids re-entering its public sequential-operation guard.
    const period = writeScope(options, writeScope(request, this.period)),
      validate = validated(options);
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
            'write',
            validate,
          );
        } else await deleteDocument(this.tx, this.name, row.id, period);
      }
      return result.rows.length;
    });
  }
  /**
   * Tracked collections: removes versions that ended, in this transaction, so the removal commits with its other
   * writes or not at all. See history-prune.ts for what stays. A removal larger than one transaction holds raises
   * LIMIT_EXCEEDED; Collection.pruneHistory() commits in batches instead.
   */
  pruneHistory(options?: PruneHistoryOptions): Promise<PruneResult> {
    return this.prune(prunePlan(options, false), options?.signal);
  }
  /**
   * Tracked collections: removes deleted documents with every version, in this transaction. After `delete(id)` in
   * the same transaction it erases a live document.
   */
  pruneDeleted(options?: PruneOptions): Promise<PruneResult> {
    return this.prune(prunePlan(options, true), options?.signal);
  }
  private prune(plan: PrunePlan, signal?: AbortSignal): Promise<PruneResult> {
    liveOnly(!!this.period);
    return this.scope.run(true, async () => {
      checkCoverage((await transactionSchema(this.tx, this.name)).schema);
      const result = { documents: 0, versions: 0 };
      const open = async () => ({ reader: this.tx, close: async () => {} });
      for await (const page of prunePages(open, this.name, plan, signal))
        for (const token of page) {
          signal?.throwIfAborted();
          // Planned and staged one by one: each plan reads what the ones before it staged.
          const planned = await planId(this.tx, this.name, plan, token, Infinity, true);
          const step = await applyPlans(this.tx, this.name, [planned], false);
          result.documents += step.touched.length;
          result.versions += step.versions;
        }
      return result;
    });
  }
  /** One batch of Collection.pruneHistory() or pruneDeleted(), planned on a snapshot. */
  [prunedStep](plans: readonly IdPlan[]) {
    return this.scope.run(true, () => applyPlans(this.tx, this.name, plans, true));
  }
  /**
   * Sets the JSON Schema every later write to this collection validates against (see validate.ts for the enforced
   * keywords), or removes it with null. Documents the collection already holds are not checked; validateCollection()
   * finds the ones that violate it.
   */
  setSchema(schema: JsonSchema | null): Promise<void> {
    currentDDL(this.period);
    const copy = copySchema(schema, this.limits);
    return this.scope.run(true, () => setSchema(this.tx, this.name, copy));
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
  insert(value: NewDocument<T>, options?: DocumentWriteOptions): Promise<PrimaryKey> {
    const copy = captureDocument<T>(value, this.limits, true),
      validate = validated(options);
    return this.write(
      (tx) => tx[capturedWrite]([copy], true, undefined, validate).then((ids) => ids[0]!),
      options,
    );
  }
  insertMany(
    values: readonly NewDocument<T>[],
    options?: DocumentWriteOptions,
  ): Promise<PrimaryKey[]> {
    const copies = captureMany(values, this.limits),
      validate = validated(options);
    return this.write((tx) => tx[capturedWrite](copies, true, undefined, validate), options);
  }
  /** Pull-driven ingestion. Each input batch commits atomically; prior receipts remain committed if a later batch fails. */
  insertBatches(
    batches: AsyncIterable<readonly NewDocument<T>[]> | Iterable<readonly NewDocument<T>[]>,
    options?: DocumentWriteOptions,
  ): AsyncGenerator<{ ids: PrimaryKey[]; revision: number; storedEntries: number }> {
    const period = writeScope(options, this.period),
      validate = validated(options);
    const {
      $historic: _time,
      $asOfRevision: _cut,
      $until: _until,
      validate: _validate,
      ...commitOptions
    } = options ?? {};
    const { host, name, limits } = this;
    return (async function* () {
      for await (const batch of batches) {
        if (commitOptions.signal?.aborted) throw new DbsonlError('ABORTED', 'Import cancelled.');
        const captured = captureMany(batch, limits);
        const { result: ids, ...receipt } = await host.transaction(
          (tx) => tx.collection<T>(name)[capturedWrite](captured, true, period, validate),
          commitOptions,
        );
        yield { ids, ...receipt };
      }
    })();
  }
  put(value: Replacement<T>, options?: DocumentWriteOptions): Promise<PrimaryKey> {
    const copy = captureDocument<T>(value as T, this.limits, false),
      validate = validated(options);
    return this.write(
      (tx) => tx[capturedWrite]([copy], false, undefined, validate).then((ids) => ids[0]!),
      options,
    );
  }
  update(id: PrimaryKey, updater: Updater<T>, options?: DocumentWriteOptions): Promise<boolean> {
    const copy = copyUpdater(updater, this.limits),
      validate = validated(options);
    return this.write((tx) => tx[capturedUpdate](id, copy, undefined, validate), options);
  }
  delete(id: PrimaryKey, options?: WriteOptions): Promise<boolean> {
    primary(id);
    return this.write((tx) => tx.delete(id), options);
  }
  /** See TransactionCollection.restore(). */
  restore(
    id: PrimaryKey,
    options?: Omit<DocumentWriteOptions, '$historic' | '$until' | '$asOfRevision'>,
  ): Promise<boolean> {
    primary(id);
    if (this.period)
      throw new DatabaseError('HISTORY_READ_ONLY', 'restore() writes the current version.');
    const validate = validated(options);
    return this.write((tx) => tx.restore(id, { validate }), options);
  }
  updateMany(
    request: FindRequest,
    updater: Updater<T>,
    options?: DocumentWriteOptions & QueryOptions<T>,
  ): Promise<number> {
    const copy = copyUpdater(updater, this.limits);
    // Capture the query before waiting for a transaction; opaque identity operands retain their identity by design.
    const stable = capture(request, this.limits);
    const execOptions = { ...bulkOptions(options), validate: validated(options) };
    return this.write((tx) => tx[capturedModifyMany](stable, copy, execOptions), options);
  }
  deleteMany(request: FindRequest = {}, options?: WriteOptions & QueryOptions<T>): Promise<number> {
    const stable = capture(request, this.limits);
    const execOptions = bulkOptions(options);
    return this.write((tx) => tx.deleteMany(stable, execOptions), options);
  }
  /**
   * Tracked collections: removes the versions that ended at or before `before` (default: every version but the
   * current state), of the named `ids` or of the whole collection; `from` narrows it to a slice of history. The
   * current state, the version in effect at `before` and what restore() needs always stay; a removed range reads
   * as absent. See history-prune.ts. The file shrinks with the next compaction.
   * VERIFIED: tests/history-prune.test.ts prunes 300 documents in several commits with a 64-operation budget.
   */
  pruneHistory(options?: PruneHistoryOptions): Promise<PruneResult> {
    return this.prune(prunePlan(options, false), options?.signal);
  }
  /**
   * Tracked collections: removes the documents deleted before `before` (default: every deleted document), of the
   * named `ids` or of the whole collection, with every version and the record of the delete. restore() then
   * returns false for them.
   */
  pruneDeleted(options?: PruneOptions): Promise<PruneResult> {
    return this.prune(prunePlan(options, true), options?.signal);
  }
  /**
   * Commits in batches of at most three quarters of `maxTransactionOperations`. Each batch is planned on a snapshot
   * and committed with point reads, so it conflicts only with a writer of a document it prunes; that document is
   * planned again. Twelve batches in a row without a removal end the call with CONFLICT.
   */
  private async prune(plan: PrunePlan, signal?: AbortSignal): Promise<PruneResult> {
    liveOnly(!!this.period);
    this.rawContext.check();
    checkCoverage(readSchema((await this.rawContext.get(schemaKey(this.name))).value));
    const budget = Math.max(1, Math.floor(this.limits.maxTransactionOperations * 0.75));
    const result = { documents: 0, versions: 0 };
    for await (const page of prunePages(() => this.rawContext.open(), this.name, plan, signal)) {
      const touched = new Set<string>();
      for (let rest = page, idle = 0; rest.length; ) {
        signal?.throwIfAborted();
        const plans: IdPlan[] = [];
        let used = 0,
          unplanned: string[] = [];
        const lease = await this.rawContext.open();
        try {
          for (let i = 0; i < rest.length; i++) {
            const next = await planId(
              lease.reader,
              this.name,
              plan,
              rest[i]!,
              budget - used,
              used === 0,
            );
            if (next.operations.length) {
              plans.push(next);
              used += next.operations.length + 1;
            }
            if (!next.done) {
              unplanned = rest.slice(i);
              break;
            }
          }
        } finally {
          await lease.close();
        }
        if (!plans.length) break;
        try {
          const step = (
            await this.host.transaction((tx) => tx.collection<T>(this.name)[prunedStep](plans), {
              signal,
            })
          ).result;
          for (const token of step.touched) touched.add(token);
          result.versions += step.versions;
          rest = [...new Set([...step.stale, ...unplanned])];
          idle = step.stale.length < plans.length ? 0 : idle + 1;
        } catch (error) {
          if ((error as { code?: string }).code !== 'CONFLICT') throw error;
          idle++;
        }
        if (idle > 12)
          throw new DbsonlError('CONFLICT', 'Documents kept changing while they were pruned.');
      }
      result.documents += touched.size;
    }
    return result;
  }
  /**
   * As TransactionCollection.setSchema(), then checks the documents the collection holds, at most `limit` violating
   * ones (default 100): the answer carries a `warning` when some violate the schema. They stay as they are. The
   * check runs after the commit, so a `signal` that aborts it leaves the schema set. Why not inside the commit: the
   * scan would join the conflict set, and a schema must not wait for old documents.
   * VERIFIED: tests/schema-validation.test.ts: 150 violating documents answer `>= 100`, and a limit out of range is
   * refused before the schema is stored.
   */
  async setSchema(
    schema: JsonSchema | null,
    options: WriteOptions & { limit?: number } = {},
  ): Promise<CollectionValidation> {
    const { limit: requested, ...commit } = options;
    const limit = checkedLimit(requested);
    currentDDL(this.period, commit);
    const copy = copySchema(schema, this.limits);
    await this.write((tx) => tx.setSchema(copy), commit);
    return this.validateCollection({ limit, signal: commit.signal });
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
