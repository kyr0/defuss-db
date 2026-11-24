import { activateBatches } from './history-activation.js';
import {
  seedCollection,
  activationKey,
  verifyTimeline,
  CLOCK,
  checkedClock,
} from './history-store.js';
import { saveSchema, transactionSchema } from './schema-cache.js';
import { CREATED_AT, enableTimestamps, stampingKey, UPDATED_AT } from './mutations.js';
import { touchCollection, versionKey } from './collection-version.js';
import {
  COLLECTIONS,
  ensureEntry,
  entryKey,
  readable,
  readEntry,
  validatedKey,
  type CollectionEntry,
} from './catalog.js';
import { timeScope, type TimeScope, type CollectionOptions } from './history-types.js';
import { ensureFormat, storeIdentity } from './format.js';
import {
  exportStream,
  exportBytes,
  captureImport,
  releaseImport,
  importRecords,
} from './archive.js';
import type { ArchiveInput, ExportOptions, ImportOptions, ImportResult } from './archive-types.js';
import { QueryCache, type QueryCacheOptions } from './query-cache.js';
import { AutoCompactor, autoCompactSettings, type AutoCompactOptions } from './compaction.js';
import { createMemoryBackend, DEFAULT_OPTIONS, openDbsonl } from 'defuss-dbsonl';
import type { Backend, Dbsonl, Options, ReadSession, Transaction } from 'defuss-dbsonl';
import type { PartialRunner } from './parallel.js';
import { DatabaseError } from './errors.js';
import { Collection, TransactionCollection } from './collection.js';
import { ReadCollection } from './query.js';
import { SearchCache } from './search.js';
import { assertSearchInput } from './search-mutations.js';
import {
  projectSearch,
  inputBytes,
  readSearchState,
  searchPrefix,
  searchStateKey,
} from './search-config.js';
import { TransactionScope } from './scope.js';
import {
  FORMAT_KEY,
  assertDocument,
  documentKey,
  documentPrefix,
  indexKey,
  collectionName,
  primary,
  range,
  readSchema,
  schemaKey,
} from './keys.js';
import type {
  Document,
  MutationLimits,
  Schema,
  OpenOptions,
  ReadContext,
  TransactionResult,
  WriteOptions,
} from './types.js';

/** Explicit snapshots hold a generation pin until close(), including across compaction. */
export class DatabaseSnapshot {
  private closed = false;
  readonly revision: number;
  constructor(
    private readonly snapshot: ReadSession<unknown>,
    private readonly parentCheck: () => void,
    private readonly searchCache: SearchCache,
    private readonly lookupConcurrency = 8,
    private readonly queryCache?: QueryCache,
    private readonly databaseId?: string,
    private readonly parallel?: PartialRunner,
  ) {
    this.revision = snapshot.revision;
  }
  private check = () => {
    this.parentCheck();
    if (this.closed) throw new DatabaseError('CLOSED', 'Snapshot is closed.');
  };
  collection<T extends CollectionEntry = CollectionEntry>(
    collection: typeof COLLECTIONS,
  ): ReadCollection<T>;
  collection<T extends Document = Document>(collection: string): ReadCollection<T>;
  collection(collection: string): ReadCollection {
    readable(collection);
    this.check();
    return new ReadCollection(collection, {
      cursorIdentity: () => this.databaseId,
      searchCache: this.searchCache,
      queryCache: this.queryCache,
      lookupConcurrency: this.lookupConcurrency,
      parallel: this.parallel,
      check: this.check,
      get: (key) => {
        this.check();
        return this.snapshot.get(key);
      },
      open: async () => {
        this.check();
        return { reader: this.snapshot, close: async () => {} };
      },
    });
  }
  exportStream(options?: ExportOptions): AsyncGenerator<Uint8Array> {
    this.check();
    return exportStream(async () => {
      this.check();
      return { reader: this.snapshot, close: async () => {} };
    }, options);
  }
  export(options?: ExportOptions): Promise<Uint8Array> {
    this.check();
    return exportBytes(async () => {
      this.check();
      return { reader: this.snapshot, close: async () => {} };
    }, options);
  }
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.snapshot.close();
    }
  }
  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
export class DatabaseTransaction {
  readonly revision: number;
  constructor(
    private readonly tx: Transaction<unknown>,
    private readonly scope: TransactionScope,
    private readonly limits: MutationLimits,
    private readonly searchCache: SearchCache,
    private readonly lookupConcurrency = 8,
    private readonly period?: TimeScope,
  ) {
    this.revision = tx.revision;
  }
  /** `_collections` is the read-only catalog; setSchema() and ensureCollection() write it. */
  collection<T extends CollectionEntry = CollectionEntry>(
    collection: typeof COLLECTIONS,
  ): ReadCollection<T>;
  collection<T extends Document = Document>(collection: string): TransactionCollection<T>;
  collection(collection: string): ReadCollection | TransactionCollection {
    readable(collection);
    this.scope.check();
    const context: ReadContext = {
      cursorIdentity: () => this.scope.cursorIdentity(),
      cursorMutation: () => this.scope.writeSequence,
      searchCache: this.searchCache,
      lookupConcurrency: this.lookupConcurrency,
      check: () => this.scope.check(),
      get: (key) => this.scope.run(false, () => this.tx.get(key)),
      open: async () => {
        const release = this.scope.enter();
        return { reader: this.tx, close: async () => release() };
      },
    };
    if (collection === COLLECTIONS) return new ReadCollection(collection, context);
    return new TransactionCollection(
      collection,
      context,
      this.tx,
      this.scope,
      this.limits,
      this.period,
    );
  }
}
export class Database {
  private readonly queryCache: QueryCache | undefined;
  private readonly searchCache = new SearchCache();
  private closed = false;
  private closing: Promise<void> | undefined;
  private readonly context: ReadContext;
  private readonly compactor: AutoCompactor | undefined;
  /** Construct through openDatabase(), openMemory(), openDirectory() or openOPFS(). */
  constructor(
    private readonly store: Dbsonl<unknown>,
    private readonly limits: MutationLimits,
    private readonly lookupConcurrency = 8,
    queryCacheOptions: false | QueryCacheOptions = {},
    private readonly databaseId?: string,
    autoCompact?: false | AutoCompactOptions,
    private readonly parallel?: PartialRunner,
  ) {
    this.queryCache = queryCacheOptions === false ? undefined : new QueryCache(queryCacheOptions);
    const compaction = autoCompactSettings(autoCompact);
    this.compactor = compaction && new AutoCompactor(store, compaction);
    this.context = {
      cursorIdentity: () => this.databaseId,
      cachePlans: true,
      queryCache: this.queryCache,
      searchCache: this.searchCache,
      lookupConcurrency: this.lookupConcurrency,
      parallel: this.parallel,
      check: this.check,
      get: (key) => {
        this.check();
        return store.get(key);
      },
      open: async () => {
        this.check();
        const snapshot = await store.beginRead();
        return { reader: snapshot, close: () => snapshot.close() };
      },
    };
  }
  private check = () => {
    if (this.closed) throw new DatabaseError('CLOSED', 'Database is closed.');
  };
  /** `_collections` is the read-only catalog; setSchema() and ensureCollection() write it. */
  collection<T extends CollectionEntry = CollectionEntry>(
    collection: typeof COLLECTIONS,
  ): ReadCollection<T>;
  collection<T extends Document = Document>(collection: string): Collection<T>;
  collection(collection: string): ReadCollection | Collection {
    this.check();
    if (readable(collection) === COLLECTIONS) return new ReadCollection(collection, this.context);
    return new Collection(collection, this.context, this, this.limits);
  }
  async ensureCollection<T extends Document = Document>(
    collection: string,
    options: CollectionOptions = {},
  ): Promise<Collection<T>> {
    this.check();
    collectionName(collection);
    const requested = options.$trackHistory,
      stamped = options.$timestamps;
    if (requested !== undefined && typeof requested !== 'boolean')
      throw new TypeError('$trackHistory must be boolean.');
    if (stamped !== undefined && typeof stamped !== 'boolean')
      throw new TypeError('$timestamps must be boolean.');
    const signal = options.signal,
      batch = options.historyBatchSize;
    signal?.throwIfAborted();
    if (batch !== undefined && (!requested || !Number.isSafeInteger(batch) || batch < 1))
      throw new RangeError('historyBatchSize requires tracking and a positive integer.');
    // Stamping first lets a history baseline seed stamped documents instead of recording a second version of each.
    // VERIFIED: tests/timestamps.test.ts, tracked collections: `_updatedAt` equals the history `from`.
    if (stamped !== undefined)
      await enableTimestamps(
        this.store,
        collection,
        stamped,
        // As history activation: each stamped document stages about six operations.
        Math.min(128, Math.max(1, Math.floor((this.limits.maxTransactionOperations - 3) / 6))),
        signal,
      );
    try {
      if (batch !== undefined)
        await activateBatches(this.store, collection, this.limits, batch, signal);
      else
        await this.store.transaction(
          async (tx) => {
            const { found, schema } = await transactionSchema(tx, collection);
            if (schema.history && requested === false)
              throw new DatabaseError('SCHEMA_MISMATCH', 'History activation is persistent.');
            if (requested && !schema.history) {
              const tracked: Schema = { ...schema, history: { coverageFrom: null } };
              // A collection written without DDL has documents to seed but no stored schema.
              const exists = found || (await tx.get(versionKey(collection))).found;
              await seedCollection(tx, collection, tracked, exists);
              tx.put(activationKey(collection), tracked.history!.coverageFrom);
              await saveSchema(tx, collection, tracked);
            } else if (!found) touchCollection(tx, collection);
          },
          { signal },
        );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        !requested ||
        batch !== undefined ||
        !['LIMIT_EXCEEDED', 'HISTORY_ACTIVATING', 'CONFLICT'].includes(code ?? '')
      )
        throw error;
      await activateBatches(this.store, collection, this.limits, undefined, signal);
    }
    // After the steps above: they create the collection, and an entry names an existing one. VERIFIED: creating
    // the entry first, with the collection's r: marker, made history activation treat a fresh collection as one
    // with unknown prehistory (22 tests of tests/history.test.ts failed, 2026-11-23).
    await ensureEntry(this.store, collection, signal);
    this.compactor?.committed();
    return this.collection<T>(collection);
  }
  get storeId(): string {
    return this.databaseId!;
  }
  exportStream(options?: ExportOptions): AsyncGenerator<Uint8Array> {
    this.check();
    return exportStream(() => this.context.open(), options);
  }
  export(options?: ExportOptions): Promise<Uint8Array> {
    this.check();
    return exportBytes(() => this.context.open(), options);
  }
  async import(input: ArchiveInput, options?: ImportOptions): Promise<ImportResult> {
    this.check();
    const prepared = captureImport(input, options);
    try {
      const committed = await this.store.transaction((tx) => importRecords(tx, prepared), {
        signal: prepared.options.signal,
      });
      this.compactor?.committed();
      return { ...committed.result, revision: committed.revision, storedEntries: committed.count };
    } finally {
      await releaseImport(prepared.input);
    }
  }
  queryCacheStats() {
    this.check();
    return this.queryCache?.stats();
  }
  clearQueryCache(): void {
    this.check();
    this.queryCache?.clear();
  }
  async collections(): Promise<string[]> {
    this.check();
    const snapshot = await this.store.beginRead();
    try {
      // VERIFIED: in mutations.ts and schema-cache.ts every write and every DDL touches the r: marker; a stored schema
      // exists only after DDL.
      const names = new Set<string>();
      for await (const row of snapshot.scan(range('r:'))) names.add(row.key.slice(2));
      for await (const row of snapshot.scan(range('s:'))) {
        readSchema(row.value);
        names.add(row.key.slice(2));
      }
      names.delete(COLLECTIONS);
      return [...names].sort();
    } finally {
      await snapshot.close();
    }
  }
  async snapshot(): Promise<DatabaseSnapshot> {
    this.check();
    return new DatabaseSnapshot(
      await this.store.beginRead(),
      this.check,
      this.searchCache,
      this.lookupConcurrency,
      this.queryCache,
      this.databaseId,
      this.parallel,
    );
  }
  /** Callback executes once. CONFLICT is explicit; the library never replays callback side effects. */
  async transaction<R>(
    callback: (tx: DatabaseTransaction) => R | Promise<R>,
    options?: WriteOptions,
  ): Promise<TransactionResult<R>> {
    this.check();
    const period = timeScope(options);
    const result = await this.store.transaction(async (raw) => {
      const scope = new TransactionScope();
      try {
        const value = await callback(
          new DatabaseTransaction(
            raw,
            scope,
            this.limits,
            this.searchCache,
            this.lookupConcurrency,
            period,
          ),
        );
        await scope.finish();
        return value;
      } finally {
        await scope.deactivate();
      }
    }, options);
    this.compactor?.committed();
    return { result: result.result, revision: result.revision, storedEntries: result.count };
  }
  async stats() {
    this.check();
    const { count, ...stats } = await this.store.stats();
    return {
      ...stats,
      storedEntries: count,
      autoCompaction: this.compactor?.stats() ?? {
        state: 'off' as const,
        runs: 0,
        conflicts: 0,
        failures: 0,
        reclaimedBytes: 0,
      },
      ...(this.parallel && { parallel: this.parallel.stats() }),
    };
  }
  async compact(
    options?: Parameters<Dbsonl<unknown>['compact']>[0],
  ): ReturnType<Dbsonl<unknown>['compact']> {
    this.check();
    const result = await this.store.compact(options);
    // Read afterwards, so a count that includes later commits only brings the next copy forward. Reading it before
    // the copy gave the background compactor time to start its own, and this copy then failed with CONFLICT.
    if (this.compactor)
      this.compactor.compacted(result.afterBytes, (await this.store.stats()).count);
    return result;
  }
  collect(): ReturnType<Dbsonl<unknown>['collect']> {
    this.check();
    return this.store.collect();
  }
  /** Audit physical records plus both directions of every declared secondary index at one revision. */
  async verify(): Promise<{
    revision: number;
    documents: number;
    indexEntries: number;
    collections: number;
  }> {
    this.check();
    await this.store.verify();
    const snapshot = await this.store.beginRead();
    try {
      const marker = await snapshot.get(FORMAT_KEY);
      storeIdentity(marker.value);
      const formatRevision = marker.revision!;
      const lastChanges = new Map<string, number>(),
        marks = new Map<string, number>();
      // The snapshot is immutable: one schema read/normalization per collection suffices for the whole audit.
      const schemas = new Map<string, Schema>();
      const schemaFor = async (collection: string) => {
        let schema = schemas.get(collection);
        if (!schema) {
          const row = await snapshot.get(schemaKey(collection));
          // Without DDL the schema is the implicit default, and the collection marker proves the collection.
          if (!row.found && !(await snapshot.get(versionKey(collection))).found)
            throw new DatabaseError('CORRUPT', 'Record has no collection.');
          schema = readSchema(row.value);
          if (schema.activating)
            throw new DatabaseError(
              'HISTORY_ACTIVATING',
              'Resume ensureCollection before verifying a staged baseline.',
            );
          schemas.set(collection, schema);
        }
        return schema;
      };
      let documents = 0,
        indexEntries = 0;
      // Timestamped collections whose existing documents are still being stamped.
      const stamping = new Map<string, boolean>();
      // A collection has an r: marker once written and a stored schema once it has DDL.
      const stored = new Set<string>();
      for await (const row of snapshot.scan()) {
        if (row.key === FORMAT_KEY) continue;
        if (row.key === CLOCK) {
          checkedClock(row.value);
          continue;
        }
        if (row.key.startsWith('l:')) {
          if (
            !/^[0-9a-f-]{36}$/.test(row.key.slice(2)) ||
            !Number.isSafeInteger(row.value) ||
            (row.value as number) < 0
          )
            throw new DatabaseError('CORRUPT', 'Invalid source lineage.');
          continue;
        }
        if (row.key.startsWith('m:')) {
          const entry = await snapshot.get(entryKey(row.key.slice(2)));
          if (row.value !== 1 || (entry.value as CollectionEntry | undefined)?.schema === undefined)
            throw new DatabaseError('CORRUPT', 'Schema marker without a schema.');
          continue;
        }
        if (/^[abehjkqt]:/.test(row.key)) {
          const schema = await schemaFor(row.key.split(':')[1]!);
          if (
            row.key.startsWith('t:') &&
            (row.key !== 't:' + row.key.split(':')[1] || row.value !== 1)
          )
            throw new DatabaseError('CORRUPT', 'Invalid history generation marker.');
          if (row.key.startsWith('k:') && row.key !== activationKey(row.key.split(':')[1]!))
            throw new DatabaseError('CORRUPT', 'Invalid activation key.');
          if (!schema.history) throw new DatabaseError('CORRUPT', 'Orphaned history record.');
          continue;
        }
        if (
          (row.key.startsWith('d:') || row.key.startsWith('s:')) &&
          row.revision > formatRevision
        ) {
          const collection = row.key.split(':')[1]!;
          lastChanges.set(collection, Math.max(row.revision, lastChanges.get(collection) ?? 0));
        }
        if (row.key.startsWith('s:')) {
          const schema = await schemaFor(row.key.slice(2));
          if (schema.history) await verifyTimeline(snapshot, row.key.slice(2), schema);
          for (const def of schema.searchIndexes)
            readSearchState((await snapshot.get(searchStateKey(row.key.slice(2), def.name))).value);
          stored.add(row.key.slice(2));
          continue;
        }
        if (row.key.startsWith('c:')) {
          const collection = row.key.slice(2);
          collectionName(collection);
          if (
            !(await schemaFor(collection)).timestamps ||
            typeof row.value !== 'string' ||
            !row.value.startsWith(documentPrefix(collection))
          )
            throw new DatabaseError('CORRUPT', 'Invalid timestamp stamping cursor.');
          continue;
        }
        if (row.key.startsWith('r:')) {
          const collection = row.key.slice(2);
          readable(collection);
          await schemaFor(collection);
          marks.set(collection, row.revision);
          if (row.value !== 1)
            throw new DatabaseError('CORRUPT', 'Invalid collection revision marker.');
          continue;
        }
        if (row.key.startsWith('d:')) {
          const collection = row.key.split(':')[1]!;
          assertDocument(row.value);
          if (documentKey(collection, row.value.id) !== row.key)
            throw new DatabaseError('CORRUPT', 'Document key and id disagree.');
          if (collection === COLLECTIONS) {
            // A catalog entry names an existing collection, and its marker says whether it holds a schema.
            const entry = readEntry(row.value);
            await schemaFor(entry.id);
            if ((await snapshot.get(validatedKey(entry.id))).found !== (entry.schema !== undefined))
              throw new DatabaseError('CORRUPT', 'Collection entry and schema marker disagree.');
            continue;
          }
          const schema = await schemaFor(collection);
          if (schema.timestamps) {
            let pending = stamping.get(collection);
            if (pending === undefined)
              stamping.set(
                collection,
                (pending = (await snapshot.get(stampingKey(collection))).found),
              );
            const doc = row.value as unknown as Record<string, unknown>,
              created = doc[CREATED_AT],
              updated = doc[UPDATED_AT];
            if (
              !pending &&
              !(
                created instanceof Date &&
                updated instanceof Date &&
                created.getTime() <= updated.getTime()
              )
            )
              throw new DatabaseError('CORRUPT', 'Missing or invalid document timestamps.');
          }
          for (const index of schema.indexes) {
            const pointer = await snapshot.get(indexKey(collection, index, row.value));
            if (!pointer.found || pointer.value !== primary(row.value.id))
              throw new DatabaseError('CORRUPT', 'Missing or incorrect index entry.');
          }
          for (const def of schema.searchIndexes) {
            const input = await snapshot.get(
              searchPrefix(collection, def.name) + primary(row.value.id),
            );
            assertSearchInput(input.value, projectSearch(row.value, def));
          }
          documents++;
          continue;
        }
        if (row.key.startsWith('u:') || row.key.startsWith('i:') || row.key.startsWith('o:')) {
          const [, collection, indexName] = row.key.split(':');
          const definition = (await schemaFor(collection!)).indexes.find(
            (index) => index.name === indexName,
          );
          if (!definition || typeof row.value !== 'string')
            throw new DatabaseError('CORRUPT', 'Orphaned index entry.');
          const doc = await snapshot.get(`d:${collection}:${row.value}`);
          if (!doc.found || indexKey(collection!, definition, doc.value as Document) !== row.key)
            throw new DatabaseError('CORRUPT', 'Stale index entry.');
          indexEntries++;
          continue;
        }
        if (row.key.startsWith('p:') || row.key.startsWith('g:')) {
          const [, collection, indexName] = row.key.split(':');
          const def = (await schemaFor(collection!)).searchIndexes.find(
            (index) => index.name === indexName,
          );
          if (!def) throw new DatabaseError('CORRUPT', 'Orphaned search record.');
          if (row.key.startsWith('p:')) {
            const token = row.key.slice(searchPrefix(collection!, indexName!).length);
            const doc = await snapshot.get(`d:${collection}:${token}`);
            if (!doc.found) throw new DatabaseError('CORRUPT', 'Orphaned search input.');
            assertSearchInput(row.value, projectSearch(doc.value as Document, def));
            indexEntries++;
          } else {
            if (row.key !== searchStateKey(collection!, indexName!))
              throw new DatabaseError('CORRUPT', 'Invalid search state key.');
            const state = readSearchState(row.value);
            let count = 0,
              bytes = 0;
            for await (const input of snapshot.scan(range(searchPrefix(collection!, indexName!)))) {
              count++;
              bytes += inputBytes(input.value as Parameters<typeof inputBytes>[0]);
            }
            if (
              count !== state.documents ||
              bytes !== state.bytes ||
              count > def.maxDocuments! ||
              bytes > def.maxInputBytes!
            )
              throw new DatabaseError('CORRUPT', 'Search state does not match inputs.');
          }
          continue;
        }
        throw new DatabaseError('CORRUPT', 'Unrecognized database record.');
      }
      for (const [collection, changed] of lastChanges)
        if ((marks.get(collection) ?? 0) < changed)
          throw new DatabaseError(
            'CORRUPT',
            'Collection revision precedes its documents or schema.',
          );
      marks.delete(COLLECTIONS);
      const collections = new Set([...marks.keys(), ...stored]).size;
      return { revision: snapshot.revision, documents, indexEntries, collections };
    } finally {
      await snapshot.close();
    }
  }
  close(): Promise<void> {
    if (!this.closing) {
      this.closed = true;
      this.searchCache.clear();
      this.queryCache?.clear();
      this.closing = (async () => {
        try {
          await this.compactor?.close();
          await this.parallel?.close();
        } finally {
          await this.store.close();
        }
      })();
    }
    return this.closing;
  }
  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
/**
 * DBSONL caches decoded tree pages, never document values, and defaults to 8 MiB and 1,024 pages. VERIFIED: with
 * DBSONL 0.7 the pages of a 100,000-document collection with one ordered index took 16.7 MiB in 3,229 pages, so
 * every full scan reloaded, re-checksummed and re-decoded them; with room for them a warm aggregate took about 45%
 * less time, a read by ID about 58% less and a bulk load 12 to 16% less. DBSONL 0.8 charges its compact pages a
 * tenth of the bytes, so the page bound applies first: the 6,455 pages of that collection compacted charged 4.1 MiB
 * instead of 43.6 MiB and held 12.8 MiB of heap instead of 16.9 MiB, about 2 KiB per page. DBSONL 0.9's format 5
 * also holds the pages of commits since its last checkpoint in memory, at most `maxCachePages` of them and at most
 * the 16 MiB of log that start a checkpoint.
 */
const PAGE_CACHE = { maxCacheBytes: 64 * 1024 * 1024, maxCachePages: 16_384 };
/** What a worker needs to open its own handle of this store. */
export interface StoreSettings {
  name: string;
  options: Options;
}
/** Open a coordinated backend. The format marker prevents accidental interpretation of unrelated DBSONL data. */
export function openDatabase(backend: Backend, options: OpenOptions = {}): Promise<Database> {
  return openWith(backend, options);
}
/** openDirectory() adds its query pool here; the pool starts only once the store exists. */
export async function openWith(
  backend: Backend,
  options: OpenOptions,
  pool?: (store: StoreSettings) => PartialRunner,
): Promise<Database> {
  const {
    name: databaseName = 'default',
    queryCache,
    autoCompact,
    ...storageOptions
  } = { ...options };
  // Invalid settings fail before the store opens.
  autoCompactSettings(autoCompact);
  const store = await openDbsonl<unknown>(backend, databaseName, {
    create: true,
    ...PAGE_CACHE,
    ...storageOptions,
  });
  let runner: PartialRunner | undefined;
  try {
    const id = await ensureFormat(store);
    // Workers open their own handles with the same page cache and limits, without creating anything.
    runner = pool?.({
      name: databaseName,
      options: { ...PAGE_CACHE, ...storageOptions, create: false },
    });
    return new Database(
      store,
      {
        maxRecordBytes: storageOptions.maxRecordBytes ?? DEFAULT_OPTIONS.maxRecordBytes,
        maxTransactionBytes:
          storageOptions.maxTransactionBytes ?? DEFAULT_OPTIONS.maxTransactionBytes,
        maxTransactionOperations:
          storageOptions.maxTransactionOperations ?? DEFAULT_OPTIONS.maxTransactionOperations,
      },
      backend.durability === 'memory' ? 1 : 8,
      queryCache,
      id,
      autoCompact,
      runner,
    );
  } catch (error) {
    await runner?.close();
    await store.close();
    throw error;
  }
}
export function openMemory(options?: OpenOptions): Promise<Database> {
  return openDatabase(createMemoryBackend(), options);
}
