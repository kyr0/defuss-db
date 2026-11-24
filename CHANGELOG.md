# Changelog

## 3.3.0

The benchmarks on the website and in docs/PERFORMANCE.md were measured on 3.2.0; this release was not measured again.

- Collection names admit letters, digits and combining marks of every script: `db.collection('商店')`, `Café` and `123` work. A name holds 1 to 64 UTF-16 code units, starts with a letter or digit and continues with letters, digits, marks, `_` or `-`. Names compare by code units, so the NFC and NFD spellings of `Ä` are two collections. Every name that 3.2.0 accepted stays valid. Index names keep the ASCII grammar.
- VERIFIED: a 3.1.0 build opens a store with a collection named `商店`, lists it in `collections()` and reads the store's ASCII collections. It then rejects that collection with a `TypeError`, and its `verify()` and `export()` fail with the same `TypeError` (probe, 2026-11-24). Upgrade every process that opens such a store before writing the first non-ASCII name. The store format marker is unchanged.

## 3.2.0

The benchmarks on the website and in docs/PERFORMANCE.md were measured on this release. Each workload is published from the least disturbed of eight runs (`make bench-runs`): on the shared benchmark host, the median of a series differed between single runs by a typical factor of 1.4 to 1.6. VERIFIED (probe, 2026-11-23): the published 3.1.0 package, measured between those runs, differed from this release by about 1% in the median over all series.

- `analyzeSchema` and `inferSchema` suggest higher-order types for string fields whose sampled values hold no whitespace: `enum` with the distinct values, `format: 'path'` when a value holds `/`, `format: 'uri'` when every value is a URL with `://`. A value that ends in two or more digits or more than 1,000 distinct values rule an enum out, and a document's own `id` is never one. `{ higherOrder: false }` answers the schema of 3.1.0.
- `collection.setSchema(schema)` sets a reviewed JSON Schema: later inserts, replacements and updates validate against it and reject with a `ValidationError` (`VALIDATION_FAILED`) that names each violated rule by JSON Pointer. Stored documents are not checked; `setSchema` answers a bounded check with a `warning`, and `validateDocument(id)` and `validateCollection({ limit })` repeat it. `schema()` reads the schema, `setSchema(null)` removes it.
- `checkSchema(schema)` and `validateValue(schema, value)`: the validator as pure functions, for a form that checks a value before it writes.
- `_collections`: a read-only catalog with one entry `{ id, schema? }` per collection that `ensureCollection()` or `setSchema()` named. The first `ensureCollection()` of a collection commits the entry after its other steps, so the database revision afterwards is one higher than in 3.1.0. Archives carry the entries.
- `{ validate: false }` on `insert`, `insertMany`, `insertBatches`, `put`, `update`, `updateMany` and `restore` stores the documents of that call without checking them against the collection's schema, for a bulk import. `restore(id)` validates by default.
- `collection.pruneHistory({ before, from, ids })` removes the versions of a tracked collection that ended at or before a date, of the whole collection, of named IDs or of a slice between two dates. `collection.pruneDeleted({ before, ids })` removes deleted documents with every version. A removed range reads as absent; the current state and what `restore()` needs stay. On a collection a prune commits in batches, in a transaction it is atomic. It runs beside writers and conflicts only with a write to a document it is pruning; stop writers of 3.1.0 builds first, since they do not rewrite the row this detection reads on a backdated write.
- The type of `JsonSchema.additionalProperties` is `JsonSchema | boolean`.
- VERIFIED: a build of the 3.1.0 sources opens a store that holds `_collections` entries, writes to it without validating, lists `_collections` in `collections()`, and fails `verify()` with `CORRUPT` and `export()` with a `TypeError` (probe, 2026-11-23). This build then reads the store and reports the documents written meanwhile in `validateCollection()`. The store format marker is unchanged.

## 3.1.0

The benchmarks on the website and in docs/PERFORMANCE.md were measured on 3.0.0; this release was not measured again.

- Calendar, text and distinct aggregates from defuss-dataview 0.8.0 and 0.9.0: `dateTrunc` and `datePart` in UTC or an IANA time zone, `epochMs` for durations between Dates, string functions, `cond` and rounding for group keys, `each` for one group per array element (as MongoDB's `$unwind`), and `countDistinct`, `distinct`, `percentile` and `median` measures. Query workers merge them, so a monthly aggregate with distinct buyers and a median runs in worker threads.
- Opt-in timestamps: `ensureCollection(name, { $timestamps: true })` sets `_createdAt` and `_updatedAt` as Dates on every write, from one time per transaction (in tracked collections the history clock, so `_updatedAt` equals the version's `from`). Existing documents are stamped in resumable batches; `verify()` checks the stamps.
- `restore(id)` in tracked collections writes back the version a delete removed, as a new version.
- `defuss-db/mongo`: MongoDB filter, sort and projection documents (objects, shell syntax or Extended JSON) with `findMongo`, aggregation pipelines with `aggregateMongo` answering in MongoDB's result shape, and their parts (`parseDocument`, `translateFilter`, `translatePipeline`, `stringify` ...). Matching follows MongoDB for null, missing fields, types, arrays (a condition matches an array when one element does) and dot paths through arrays of documents, with `$elemMatch`, `$all`, `$size`, `$type`, `$mod`, the `$bits` operators and `$regex` with the option `i`; 166 filters return the same documents as MongoDB 9.0.8. Conditions on a top-level field that an index covers become filters the index answers. `$dateTrunc` takes `timezone`, `binSize` and `startOfWeek`, and `$group` also takes `$stdDevPop` and `$stdDevSamp`.
- `analyzeSchema(collection, { sample, at })` and `inferSchema(docs)`: a JSON Schema (draft 2020-12) of a sample spread over the whole collection, or of the collection as it was at a date; DSON types named in `x-dson`, optional fields in `x-presence`.
- Fixed: a query at a past date raised `INVALID_INDEX_VALUE` when a version visible then held an object or array in a field indexed later. Equality indexes still answer such views exactly. An ordered index that cannot key a visible version, or an index whose key for it would exceed the key limit, is left to a scan, and explicit pages and counts of that ordered index raise `INVALID_INDEX_VALUE` instead of leaving the version out.
- defuss-dataview 0.10.0.

## 3.0.0 (2026-11-21)

First release of the standalone rewrite over defuss-dataview, defuss-dbsonl, defuss-storage and defuss-dson. Nothing was released between 2.0.2 and 3.0.0; this release does not read stores or archives written by 2.x or by development builds.

- One document API for dedicated browser workers (OPFS), Node.js and Bun (directory) and memory, with native JavaScript values through DSON.
- Atomic transactions across collections with optimistic conflict detection and pinned snapshots. An operation started after a transaction callback returns rejects with `CLOSED`.
- Primary, equality, unique and ordered compound indexes with keyset pagination, ID-only pages and bounded range counts. String IDs and equality-index strings are stored as text instead of four hex digits per code unit: a 100,000-document load with 6-character string IDs and one ordered index wrote 112 MiB instead of 163 MiB.
- Full-text (BM25), vector and hybrid search, maintained atomically with the documents.
- Opt-in document history: effective-date reads and corrections, recorded-revision reads, audit trails and temporal uniqueness.
- A revision-validated query result cache.
- A larger default page cache (`maxCacheBytes: 64 MiB`, `maxCachePages: 16384`), so the tree pages of a collection with 100,000 documents and one index stay cached between scans; with DBSONL 0.8 the page count binds first, about 2 KiB of heap per page.
- Background compaction (`autoCompact`, on by default): a non-blocking copy when the connection is idle and the file is 1.5 times its live size or its last packed size, and a bound at four times the live size, so the in-memory backend and directory stores stay near their data size. The live size is the packed size scaled by the stored entries since, so inserted documents do not count as garbage: a 100,000-document load copied the store once instead of four times and took 4.4 to 4.9 s instead of 9.7 s.
- defuss-dataview 0.7.0, defuss-dbsonl 0.9.0 and defuss-storage 0.4.1. New stores use DBSONL format 5. Its commits need one flush (a durable update took 4.06 ms instead of 8.3 ms on macOS with format 3's records), its index pages take a tenth of format 3's bytes, and it writes them only at checkpoints, logging each commit's key changes in between. In the MongoDB comparison under Node.js a 64-document commit took 4.8 ms, against 6.0 ms with format 4 and 7.6 ms with format 3, and loading 100,000 documents took 2.9 s instead of 4.5 s with format 4. Under Bun on macOS a flush now empties the drive cache, as under Node.js.
- Full-collection aggregates, projections, views, counts and search index builds on directory storage scan in DBSONL's worker pool: a grouped aggregate over 100,000 documents took 83 ms instead of 131 ms. `openDirectory()` accepts `scanWorkers`, `scanThreshold` and `syncReadBytes`.
- Query workers, on by default for directory stores: full-scan aggregates and counts are answered from partial aggregates of worker threads over one snapshot; `parallel: false` turns them off. A grouped aggregate with exact sums over 100,000 documents took 23.7 ms with eight workers instead of 98.6 ms, against 30.7 ms for MongoDB on the same machine.
- Brotli archives for latest-only and full-history export and import. An import closes its input stream on every outcome.
- Store format marker 5. Only DDL stores a collection schema, so concurrent first writes to a new collection do not conflict.
- A same-machine comparison with MongoDB (`make bench-mongo`) and a browser e2e run over every website page.
- The website embeds Ledger, a playground that keeps 100,000 orders, reports, price history, accounts and a searchable catalog in one OPFS store; `scripts/e2e-demo.mjs` drives every tab in Chromium. Setup installs `defuss-db` from npm instead of a downloaded tarball.
