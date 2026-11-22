# Database

What opening returns: typed collections, transactions across collections, snapshots, archives, statistics and maintenance.

| Member | Signature | Description |
| --- | --- | --- |
| [collection](Database/collection.md) | `collection<T extends Document = Document>(collection: string): Collection<T>` | Typed live collection; no I/O merely to obtain it |
| [ensureCollection](Database/ensureCollection.md) | `ensureCollection<T extends Document = Document>(collection: string, options?: CollectionOptions): Promise<Collection<T>>` | Persist $trackHistory and $timestamps, then return the collection; idempotent, and both settings are permanent |
| [collections](Database/collections.md) | `collections(): Promise<string[]>` | Persisted collection names, including now-empty collections |
| [transaction](Database/transaction.md) | `transaction<R>(callback: (tx: DatabaseTransaction) => R \| Promise<R>, options?: WriteOptions): Promise<TransactionResult<R>>` | { result, revision, storedEntries }; callback runs once |
| [snapshot](Database/snapshot.md) | `snapshot(): Promise<DatabaseSnapshot>` | Read-only DatabaseSnapshot, with revision, collection<T>, close |
| [export](Database/export.md) | `export(options?: ExportOptions): Promise<Uint8Array>` | Uint8Array Brotli archive; buffered, default 64 MiB compressed cap |
| [exportStream](Database/exportStream.md) | `exportStream(options?: ExportOptions): AsyncGenerator<Uint8Array>` | Pull-driven AsyncGenerator<Uint8Array> holding one snapshot |
| [import](Database/import.md) | `import(input: ArchiveInput, options?: ImportOptions): Promise<ImportResult>` | Atomic archive import and index rebuild; receipt with counts/revisions |
| [queryCacheStats](Database/queryCacheStats.md) | `queryCacheStats(): QueryCacheStats \| undefined` | Result/plan/pending counters and accounted bytes, or undefined when disabled |
| [clearQueryCache](Database/clearQueryCache.md) | `clearQueryCache(): void` | Clear results/history/plans and invalidate in-flight admissions |
| [stats](Database/stats.md) | `stats(): Promise<{` | DBSONL metadata; storedEntries includes documents, schemas, indexes and marker; autoCompaction holds state, runs, conflicts, failures and reclaimedBytes; on directory stores, parallel holds state (idle, starting, ready, failed, closed), workers, minRows, queries, fallbacks, starts and, after a failed start, error |
| [verify](Database/verify.md) | `verify(): Promise<{` | { revision, documents, indexEntries, collections } after physical and logical audit |
| [compact](Database/compact.md) | `compact(options?: Parameters<Dbsonl<unknown>['compact']>[0]): ReturnType<Dbsonl<unknown>['compact']>` | Delegated DBSONL compaction; default optimistic, or { mode: 'exclusive' } |
| [collect](Database/collect.md) | `collect(): ReturnType<Dbsonl<unknown>['collect']>` | Delegated reclamation of unpinned generations |
| [close](Database/close.md) | `close(): Promise<void>` | Idempotent close; database and snapshots support Symbol.asyncDispose |

Interactive: [Database in the app](../../app-api-docs.html#/ref/Database).
