# API reference

## Historical collections

Use `await db.ensureCollection<T>(name, { $trackHistory: true })`. Calls on `collection.at(date)` share an effective instant. Add `{ $asOfRevision: receipt.revision }` to reproduce the database's earlier answer. `history(id)` lists effective segments and `audit(id)` lists recorded changes. [API, correction boundaries, search and backup](HISTORY.md)


All methods use the same APIs on memory, files and OPFS. See generated `.d.mts`/`.d.cts` declarations for exact generic result inference.

## Opening

| Function | Entry | Arguments |
| --- | --- | --- |
| `openMemory` | `defuss-db` | `OpenOptions?` |
| `openDatabase` | `defuss-db` | Coordinated DBSONL `Backend`, `OpenOptions?` |
| `openDirectory` | `defuss-db/server` | Root path, `OpenOptions & { storage?: FileBackendOptions; parallel?: boolean \| ParallelOptions }` |
| `openOPFS` | `defuss-db/browser` | `OpenOptions & { namespace?: string; storage?: OPFSStorageOptions without name }` |

`OpenOptions`: `name` (default `default`), `create` (default `true`), `signal`, `queryCache` (automatic by default; false or cache configuration), `autoCompact` (on by default; false or `{ minBytes, growth, idleMs }`, see [operations](OPERATIONS.md#reclaim-space)), and DBSONL resource options. Existing storage opens with `create: false`. Logical database names follow DBSONL's lowercase 1–64-character name grammar. Collection/index names match `[A-Za-z][A-Za-z0-9_-]{0,63}`.

| Storage limit | Default |
| --- | ---: |
| `maxRecordBytes` | 16 MiB |
| `maxTransactionBytes` | 64 MiB |
| `maxTransactionOperations` | 10,000 |
| `maxPendingOperations` | 256 |
| `maxPendingBytes` | 128 MiB |
| `maxCacheBytes` | 64 MiB, counted in encoded page bytes; with DBSONL 0.8's compact pages `maxCachePages` (16,384) binds first; a cached page measured about 2 KiB of heap. Document values are not cached |
| `maxCachePages` | 16,384 |

Operation counts include physical schema/index entries, not just documents. For example, a document plus two indexes consumes three distinct staged keys; each changed collection consumes one revision key per transaction, and initial schema creation consumes another. The underlying engine additionally checks encoded framing sizes. Index builds can need one entry per indexed document plus metadata.

Server `storage.io` accepts the Storage adapter's optional synchronous read mode; it can help dedicated database workers but can block the application's event loop. The default keeps the upstream asynchronous mode. `parallel` controls the query worker threads that answer mergeable full-scan aggregates and counts together. They are on by default; `false` turns them off, and `{ workers, minRows }` sets them, with `workers` default one fewer than the CPUs, at most 8, and `minRows` (documents the collection must hold) default 1,000. See [Answer aggregates in worker threads](OPERATIONS.md#answer-aggregates-in-worker-threads). `storage` also takes DBSONL's scan pool and read options: `scanWorkers` (worker threads for large scans; default up to 4, one fewer than the CPUs; 0 turns the pool off), `scanThreshold` (rows a scan must cover before it runs in the pool; default 5,000) and `syncReadBytes` (reads up to this size are blocking calls; default 16 KiB; 0 sends every read through the thread pool, for network or slow storage). Memory factories reuse the same serialized storage path, not a special object-map database.

## Database

| Method | Result / behavior |
| --- | --- |
| `collection<T>(name)` | Typed live collection; no I/O merely to obtain it |
| `collections()` | Persisted collection names, including now-empty collections |
| `transaction(callback, options?)` | `{ result, revision, storedEntries }`; callback runs once |
| `snapshot()` | Read-only `DatabaseSnapshot`, with `revision`, `collection<T>`, `close` |
| `export(options?)` | `Uint8Array` Brotli archive; buffered, default 64 MiB compressed cap |
| `exportStream(options?)` | Pull-driven `AsyncGenerator<Uint8Array>` holding one snapshot |
| `import(input, options?)` | Atomic archive import and index rebuild; receipt with counts/revisions |
| `queryCacheStats()` | Result/plan/pending counters and accounted bytes, or undefined when disabled |
| `clearQueryCache()` | Clear results/history/plans and invalidate in-flight admissions |
| `stats()` | DBSONL metadata; `storedEntries` includes documents, schemas, indexes and marker; `autoCompaction` holds `state`, `runs`, `conflicts`, `failures` and `reclaimedBytes`; on directory stores, `parallel` holds `state` (`idle`, `starting`, `ready`, `failed`, `closed`), `workers`, `minRows`, `queries`, `fallbacks`, `starts` and, after a failed start, `error` |
| `verify()` | `{ revision, documents, indexEntries, collections }` after physical and logical audit |
| `compact(options?)` | Delegated DBSONL compaction; default optimistic, or `{ mode: 'exclusive' }` |
| `collect()` | Delegated reclamation of unpinned generations |
| `close()` | Idempotent close; database and snapshots support `Symbol.asyncDispose` |

Write options accept `ifRevision` for whole-store compare-and-swap and `signal`. Revisions are database-wide, not per collection. A transaction object exposes `revision` and `collection<T>`. A transaction collection has the same read APIs and the mutation APIs below, without an independent commit option.

## Collection mutations

| Method | Semantics / result |
| --- | --- |
| `insert(document, options?)` | Reject existing ID; return ID; omitted ID generates UUID |
| `insertMany(documents, options?)` | One atomic bounded batch; return IDs |
| `insertBatches(iterable, options?)` | Async generator of `{ ids, revision, storedEntries }`; one atomic commit per input batch |
| `put(document, options?)` | Insert or replace whole document with required ID; return ID |
| `update(id, patchOrCallback, options?)` | Shallow own-property patch or complete replacement callback; return whether ID existed |
| `delete(id, options?)` | Return whether ID existed |
| `updateMany(request, patchOrCallback, options?)` | Atomic bounded set update; return affected document count |
| `deleteMany(request?, options?)` | Atomic bounded set deletion; return affected document count |
| `createIndex(definition, options?)` | Atomic equality or ordered build. Set `order` to one direction per field. An identical declaration is idempotent; mismatched existing name rejects |
| `createSearchIndex(definition, options?)` | Atomic lexical/vector/hybrid build; see [Search](SEARCH.md) |
| `dropSearchIndex(name, options?)` | Atomic removal of search inputs, state and definition |
| `dropIndex(name, options?)` | Atomic removal; return whether it existed |

`updateMany`/`deleteMany` accept DataView query resource options alongside write options. Their collected output caps cannot exceed the transaction limits. A callback update can be asynchronous; it executes once, receives the current decoded document, and must preserve its typed ID. Patches cannot contain `id`. Upsert-by-ID is `put`; there is no ambiguous selector-based upsert.

`IndexDefinition`: `{ name, fields: string[], unique?: boolean }`. Unique indexes treat missing/undefined and null as distinct values, each allowed at most once for a given compound tuple. Ordinary objects/arrays/Maps/Sets cannot be index components. No prefix/range index use is claimed.

## Collection reads

| Method | Result |
| --- | --- |
| `get(id)` | Document or `undefined` |
| `getMany(ids, { signal }?)` | Ordered documents/undefined; duplicate IDs preserved; one snapshot; at most 100,000 IDs |
| `searchIndexes()` | Persisted search definitions |
| `search(index, query, options?)` | Revision-bound scored hits; see [Search](SEARCH.md) |
| `has(id)` | Boolean |
| `find(request?, options?)` | Document array |
| `findOne(request?, options?)` | First matching document or `undefined`; effective limit is one |
| `query(request?, options?)` | `{ rows, summary }` |
| `pageIdsByIndex(index, options?)` | Keyset page of typed primary IDs. Returns `{ rows, nextCursor, revision }`. Accepts document-page cursors for the same scope and range. |
| `countByIndex(index, options?)` | Exact number of ordered index entries matching `prefix` and bounds. Optional `maxScannedEntries` rejects excessive work. Accepts an abort signal. |
| `pageByIndex(index, options?)` | Seek page of documents with `rows`, `nextCursor` and snapshot `revision`. [Cursor contract](ORDERED.md) |
| `stream(request?, options?)` | DataView `batch` / `complete` events |
| `count(selection?, options?)` | Exact count of matching documents |
| `select(descriptor, page?, options?)` | Typed projected rows and summary |
| `aggregate(descriptor, page?, options?)` | Typed grouped/scalar rows and summary |
| `view(descriptor, page?, options?)` | Typed projected rows, totals and summary |
| `prepareFind/Select/Aggregate/View` | Bound prepared plan: `evaluate`, `stream`, `explain` |
| `explain(request?)` | `{ revision, access, query }`; access selection for the inspected snapshot |
| `source()` | Document-level DataView `RecordSource<T>` |
| `indexes()` | Fresh persisted equality and ordered definitions |
| `q` | DataView `forRows<T>()` builders and plan factories |

`FindRequest`: `filters`, `where`, `semantics`, `sorters`, `offset`, `limit`, `numberMode`, `invalidNumbers`, `access: 'auto' | 'scan'`. Filters support `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `startsWith`, `endsWith`. Filters are ANDed. `where` uses `q.and`, `q.or`, `q.not`, comparisons, arithmetic and nullish tests. Query fields use DataView's safe own-property rules, not prototype traversal. A `prepareFind` plan captures its default page; passing a page to `evaluate` replaces that default page.

Projection descriptors contain `select: { alias: Expr }`, optional `filters/where`, and `orderBy: [{ expr, direction }]`. Aggregate descriptors contain optional `groupBy`, required `measures`, optional `having` over result aliases, and output-alias `orderBy`. View descriptors contain `select`, `totals` and row-expression ordering. These are DataView descriptors, not a separate SQL dialect.

`ComputeOptions`: `count`, `batchSize`, `maxBatchBytes`, `maxRowBytes`, `maxScannedRows`, `maxWorkingBytes`, `maxGroups`, `maxOutputRows`, `maxOutputBytes`, `yieldEveryBatches`, `profile`, `sizeOf`, `sizeOfOutput`, `signal`. Custom `sizeOf` sees public documents. Custom `sizeOfOutput` sees actual public output rows, including whole documents for `find/query/stream`. Estimators must be pure and stable; they account memory and do not serialize values.

Default grouping/working-state capacity is 64 MiB and 100,000 groups; collected output is limited to 100,000 rows and 64 MiB. Use streaming for larger row output and explicit budgets for large sorts/groups. Streaming does not make an unbounded sort or grouping bounded without a cap.

Summary fields are DataView's `ComputeSummary`. `revision` identifies the snapshot; `scannedRows` counts candidate documents seen by the query executor. `sourceRows` describes the candidate source, not necessarily the entire collection. `totalInputMatches` and `totalResultRows` may be `null` if execution legitimately stops early; `count: 'exact'` requires exact result totals. `hasMore`, `sourceExhausted`, strategy and peak accounting remain explicit. A failed/cancelled stream does not emit a successful complete event; earlier batches may already have been consumed.

Default ordering without `sorters/orderBy` follows typed storage keys. It is not insertion order or numeric ID order. Specify a deterministic tie-breaker such as `id` when pagination needs an explicit order. Use `pageByIndex` for keyset traversal in declared index order, including the storage-ID tie-breaker.

`explain().access.kind` can be `scan`, `primary`, `primary-in`, `equality`, `range` or `ordered`. Ordered/range plans expose the index name, length of the fixed equality prefix, and range field when present. `primary-in` and bounded `range` plans report their point-key count. Explaining a bounded range may probe index pointers.

## Errors

`DatabaseError` codes: `DUPLICATE_KEY`, `SCHEMA_MISMATCH`, `INVALID_DOCUMENT`, `INVALID_INDEX_VALUE`, `CORRUPT`, `INVALID_CURSOR`, `STALE_CURSOR`, `CLOSED`, `BUSY`, `UNFINISHED_TRANSACTION`. Input validation can also throw `TypeError`/`RangeError`; strict DSON errors remain intact.

DBSONL errors (`CONFLICT`, `COMMIT_UNCERTAIN`, `LIMIT_EXCEEDED`, `QUEUE_FULL`, `ABORTED`, corruption etc.), DataView errors, and Storage errors retain their original codes/causes. `COMMIT_UNCERTAIN` means publication status must be inspected before retrying; never blindly retry non-idempotent writes. Capacity limits, unsupported platforms and browser quota errors fail explicitly. Nothing silently downgrades durability or repairs corruption.

## Archives and result caching

See [Archive API](ARCHIVE.md) for options, framing, budgets and merge behavior. Explicit snapshots support both export methods, but no import. See [Query cache](CACHE.md) for default automatic qualification, `{ cache: false | true | 'auto' | 'refresh' }`, manual mode, LRU/SLRU settings, bounded compiled plans, concurrent misses, independent result ownership and revision keys.
