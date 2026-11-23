# Source architecture

`database.ts` owns factory setup, the format marker, cross-collection transactions, explicit snapshots and maintenance. `collection.ts` adds document writes and input capture; `mutations.ts` stages documents and index ownership in one underlying transaction. `scope.ts` prevents escaped/overlapping transaction use and incomplete callbacks.

`query.ts` validates/lifts declarative DataView expressions and preserves inferred output types. `source.ts` chooses a same-revision candidate path and supplies real DBSONL batches through the official DataView adapter. It never claims that candidate counts equal full-collection counts. `keys.ts` owns typed IDs, field extraction for indexes, canonical equality tuples and schema validation. `types.ts` is the public contract; `errors.ts` preserves DB-layer error codes.

`index.ts` is platform-independent. `server.ts` uses the DBSONL native backend; `browser.ts` combines Storage OPFS with DBSONL Web Locks. No module performs database I/O merely on import. See the root architecture for consistency, memory limits and security boundaries.

`catalog.ts` owns `_collections`: the entries, the `m:` schema marker, the per-transaction schema read of the write path and the entry of an archive. `validate.ts` is the pure validator: `checkSchema` refuses a schema it would not enforce in full and `validateValue` lists what a value violates. `json-schema.ts` infers schemas and owns the `format` predicates that validation enforces.

`schema-cache.ts` caches schema reads within a transaction and refreshes on DDL. `reads.ts` drains bounded parallel lookups before errors release snapshots. `paths.ts` performs own-property field access shared by equality/search projection.

`search-types.ts` declares the serializable search contract. `search-config.ts` validates configuration, language analyzers, text projection and vector normalization. `search-mutations.ts` maintains projected inputs and generation state atomically. `search.ts` runs upstream engines with a bounded immutable-generation cache, pre-top-k DataView filtering and same-snapshot hit hydration.

`parallel.ts` decides whether an aggregate runs in query workers and merges their partials; `query-pool.ts` (server entry) starts and routes the worker threads, and `parallel-worker.ts` is the worker. `batches.ts` scans ranges so that DBSONL may use its worker pool: a bounded first scan, then the rest from the last key, with rows measured and split by the caller. `measured.ts` lets DataView reuse the byte size the source measured for each scanned row. `compaction.ts` decides when the database compacts: a pure due-check and a per-connection compactor that commits notify, with an idle trigger and a growth bound; DBSONL performs the copy. `archive-types.ts` defines portable import/export inputs and budgets. `archive.ts` owns frame validation, lazy Brotli codecs, pull-driven export and atomic import/index reconstruction. `query-cache.ts` owns exact result keys, encoded value retention, bounded SLRU/LRU and second-use history. It does not cache transaction reads.

`query-cache.ts` also owns automatic qualification, exact tagged descriptor keys, a separate bounded compiled-plan LRU and count-bounded pending misses. Only live read contexts retain bound plans. Coalesced callers decode independent results; signal-bearing misses execute independently. `query.ts` skips implicit keying for automatic primary-key reads/profiling. `search.ts` batches cold engine input through native scans and lexical `addAll`.

`format.ts` installs or explicitly upgrades the store marker and persistent UUID. `collection-version.ts` blind-writes one revision marker per changed collection per transaction. Readers use its actual DBSONL commit revision. The result cache and index cursors check it in the same snapshot as their data.

`ordered-key.ts` implements DataView-compatible scalar order. `ordered-access.ts` constructs storage intervals and checks whether the complete requested sort is satisfied. `source.ts` also restores natural order for small ranges and typed ID lists. `index-page.ts` scopes continuations, seeks and verifies page pointers. The integrity audit in `database.ts` checks ordered indexes in both directions and compares collection markers with visible post-upgrade mutations.

`index-page.ts` captures and resolves a single compound interval in a reader lease. Native sessions provide bounded pointer batches. Transactions supply their own staged iterator. ID output decodes the database-owned primary token. Full rows also validate their index tuple against the hydrated document. Exact counts skip primary fetches and stop with an error if a scan budget is exceeded.

## History

`history-types.ts` captures date options and defines public receipts. `history-store.ts` owns immutable facts, interval lookup, recorded and effective listings, constraint checks and verification. `history-view.ts` adapts one temporal slice to the ordinary query and search readers. `history-index-cache.ts` retains bounded secondary postings per database. `history-activation.ts` publishes or resumes a batched baseline. `history-prune.ts` removes ended versions and deleted documents. Archive framing, storage, DSON and query evaluation continue to use their existing packages.
