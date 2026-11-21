# Operate a store

Back up a directory or OPFS namespace before activating history or importing into it.

Every store carries format marker 5 and a random store identity. Opening a store with any other marker fails with `SCHEMA_MISMATCH`, so a store written by another build is never misread: export it with the build that wrote it and import the archive. Copying a closed physical store preserves its identity and cursor scope.

## Start recording

Call `db.ensureCollection(name, { $trackHistory: true })`. Enabling a collection that already holds documents seeds them at one effective instant. Reads before that baseline raise `HISTORY_UNAVAILABLE`. A newly created tracked collection can accept backdated initial facts.

For large collections, set `historyBatchSize` and resume an interrupted baseline by repeating the same call. Ordinary reads remain available during activation. The collection accepts writes after the baseline publishes.

## Reclaim space

Every commit appends copy-on-write pages and never overwrites old ones, so a store grows faster than its data. VERIFIED: in `docs/benchmarks/mongodb-node.json`, `compaction[].reclaimedBytes` shows what background compaction removed while loading each collection. A connection compacts in the background:

- After `idleMs` (1,000 ms) without a commit of its own, once the file is 1.5 times its live size, or 1.5 times the size it had when it was last packed. The second condition restores key order after a load that left little garbage: range reads and scans then read neighbouring frames. This copy never blocks writers; a commit drops it.
- Under sustained writes, once the file reaches `growth` (4) times its live size and at least `minBytes` (1 MiB). After one interrupted attempt this copy queues writers until it is installed, so the pause grows with the live data.

The live size is the size the last compaction left, scaled by the stored entries since, so inserted documents do not count as garbage and deleted ones do. VERIFIED: a 100,000-document load into an empty directory store copied it once during the load and once after it.

`db.stats().autoCompaction` reports the state and counts runs, conflicts, failures and reclaimed bytes. A failed copy, for example on a full disk, waits for another growth step instead of retrying at once. For a one-off bulk import, open with `autoCompact: false`, load, then call `compact()` and `collect()` once, to choose when that copy runs. Snapshots pin their generation, so close them when finished.

## Size the page cache

The database caches decoded tree pages up to `maxCacheBytes` (64 MiB of encoded pages) and `maxCachePages` (16,384); with compact pages the page count binds first, at about 2 KiB of heap per page. Document values are never cached; scans read and decode them every time. `db.stats().cacheBytes` and `cachePages` show the current use. When they sit at the limit and scans or reads by ID slow down as a collection grows, raise both options when opening the database.

## Scan in worker threads

On directory storage, scans that cover 5,000 rows or more run in a pool of up to four worker threads, one fewer than the CPUs: full-collection aggregates, projections and search index builds, and exports. Short pages stay in the calling thread. Set `storage: { scanWorkers: 0 }` in `openDirectory()` to turn the pool off, for example when the process already runs one database per CPU. Memory and browser stores scan in the calling thread. On network or slow storage set `storage: { syncReadBytes: 0 }`, so a slow read does not block the event loop.

## Answer aggregates in worker threads

A directory store answers an aggregate or count in query worker threads when it scans the whole collection, the collection holds at least `minRows` (1,000) documents, and DataView can merge its parts: counts, minima, maxima and BigInt sums always, `sum` and `avg` only under `numberMode: 'exact'`. It runs up to eight workers, one fewer than the CPUs, each with its own handle of the store. The first such query starts them and runs in the calling thread, as does every query while they start; they close after 30 seconds without a query. Each running worker holds a page cache of up to 64 MiB. `db.stats().parallel` shows the state, the queries the workers answered, `fallbacks` (queries sent back to the calling thread after a worker failed) and the last start error. Set `parallel: false` in `openDirectory()` to turn them off, or `parallel: { workers, minRows }` to size them.

## Move data

Use `exportStream({ history: 'full' })` and import into an empty target to carry effective intervals, tombstones, schema changes and source receipts. A latest-only archive carries current documents and index definitions. A logical restore has its own physical store identity. [Document history](HISTORY.md) · [Archive format and limits](ARCHIVE.md)
