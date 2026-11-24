# Opening

The members are in the reference: [Opening](../../app-api-docs.html#/ref/Opening).

`OpenOptions`: `name` (default `default`), `create` (default `true`), `signal`, `queryCache` (automatic by default; false or cache configuration), `autoCompact` (on by default; false or `{ minBytes, growth, idleMs }`, see [operations](../../../guides/operations.html#reclaim-space)), and DBSONL resource options. Existing storage opens with `create: false`. Logical database names follow DBSONL's lowercase 1–64-character name grammar. Collection names hold 1 to 64 UTF-16 code units: a letter or digit of any script, then letters, digits, combining marks, `_` or `-`, so `商店` and `Café` work. Names compare by code units, so the NFC and NFD spellings of `Ä` are two collections. Index names match `[A-Za-z][A-Za-z0-9_-]{0,63}`.

| Storage limit | Default |
| --- | ---: |
| `maxRecordBytes` | 16 MiB |
| `maxTransactionBytes` | 64 MiB |
| `maxTransactionOperations` | 10,000 |
| `maxPendingOperations` | 256 |
| `maxPendingBytes` | 128 MiB |
| `maxCacheBytes` | 64 MiB, counted in encoded page bytes; with DBSONL's compact pages `maxCachePages` (16,384) binds first; a cached page measured about 2 KiB of heap. Document values are not cached. DBSONL 0.9 also holds up to `maxCachePages` index pages of commits since its last checkpoint in memory |
| `maxCachePages` | 16,384 |

Operation counts include physical schema/index entries, not just documents. For example, a document plus two indexes consumes three distinct staged keys; each changed collection consumes one revision key per transaction, and initial schema creation consumes another. The underlying engine additionally checks encoded framing sizes. Index builds can need one entry per indexed document plus metadata.

Server `storage.io` accepts the Storage adapter's optional synchronous read mode; it can help dedicated database workers but can block the application's event loop. The default keeps the upstream asynchronous mode. `parallel` controls the query worker threads that answer mergeable full-scan aggregates and counts together. They are on by default; `false` turns them off, and `{ workers, minRows }` sets them, with `workers` default one fewer than the CPUs, at most 8, and `minRows` (documents the collection must hold) default 1,000. See [Answer aggregates in worker threads](../../../guides/operations.html#answer-aggregates-in-worker-threads). `storage` also takes DBSONL's scan pool and read options: `scanWorkers` (worker threads for large scans; default up to 4, one fewer than the CPUs; 0 turns the pool off), `scanThreshold` (rows a scan must cover before it runs in the pool; default 5,000) and `syncReadBytes` (reads up to this size are blocking calls; default 16 KiB; 0 sends every read through the thread pool, for network or slow storage). Memory factories reuse the same serialized storage path, not a special object-map database.

Interactive: [Opening in the app](../../app-api-docs.html#/guides/opening).
