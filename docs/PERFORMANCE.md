# Query, search and storage benchmarks

## A compound index for a tenant feed

Return the 20 highest-scoring events for one tenant. The collection has 4,096 events, 64 tenants and 64 events per tenant. Both paths query the same collection at the same revision on the same backend. Both return complete event documents in identical order. A JavaScript filter and sort verifies every result outside the timed interval.

The ordered index stores tenant ascending and score descending. Equality on the first field lets the database seek directly to the tenant. The remaining keys are already in score order, so the reader stops after 20 events and one lookahead. The collection scan reads all events, filters and orders the matches. The query uses the same page size, snapshot acquisition and count mode on both paths. Result caching is disabled. Plans and indexes are prepared before timing.

| Runtime | Storage for both paths | Compound index (ms) | Collection scan (ms) | Rows examined, index / scan |
| --- | --- | ---: | ---: | ---: |
| Node | memory | 0.473 | 7.23 | 21 / 4096 |
| Node | directory | 0.963 | 20.85 | 21 / 4096 |
| Bun | memory | 0.816 | 7.58 | 21 / 4096 |
| Bun | directory | 0.959 | 18.39 | 21 / 4096 |

### What the index costs on writes

Each pair commits the same batch of 64 new events to two collections on the same database. Both start with 4,096 identical events and maintain primary keys. One also maintains the tenant–score index. Every round inserts fresh IDs. Each latency covers the full batch and commit. The initial index build is outside these timings.

| Runtime | Storage for both collections | With compound index (ms) | Primary keys only (ms) |
| --- | --- | ---: | ---: |
| Node | memory | 0.727 | 0.496 |
| Node | directory | 4.08 | 3.99 |
| Bun | memory | 0.705 | 0.324 |
| Bun | directory | 4.15 | 4.00 |

## Compared with MongoDB on one machine

Both systems run on the same machine and hold the same documents: a numeric ID, one of 64 tenants, one of 16 regions, a unique score, a Date and a short label. Both maintain the same compound index on tenant ascending and score descending. defuss-db runs inside the benchmark process on directory storage. MongoDB 9.0.8 runs as a standalone wiredTiger server and is reached over loopback TCP through the official driver 7.8.0. Each run measures 10,000 and 100,000 documents. Every timed result is compared with the other system and with a JavaScript oracle outside the timed interval.

A defuss-db write returns after its commit is flushed to the storage device. MongoDB with the default write concern (`w: 1`) acknowledges a write before its journal is flushed. With `j: true` it waits for the journal flush, which makes it the durability match for defuss-db writes. Read operations have no journal column. The last column compares defuss-db reads with MongoDB `w: 1` and defuss-db writes with MongoDB `j: true`.

### Node.js 26.13.1

| Operation | Documents | defuss-db (ms) | MongoDB `w: 1` (ms) | MongoDB `j: true` (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.016 | 0.172 | n/a | 10.8× faster |
| One tenant's top 20 documents | 10,000 | 1.23 / 0.787 | 0.567 | n/a | 1.4× slower |
| Count one tenant's upper score half | 10,000 | 1.87 | 0.787 | n/a | 2.4× slower |
| Count and sum by region, full scan | 10,000 | 33.99 / 11.03 | 4.66 | n/a | 2.4× slower |
| Count and sum by region, repeated | 10,000 | 0.088 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 4.03 | 0.361 | 4.24 | 1.1× faster |
| Update one document, 32 concurrent writers | 10,000 | 0.170 | 0.035 | 0.281 | 1.7× faster |
| Insert 64 documents in one commit | 10,000 | 4.85 | 0.951 | 4.79 | 1.0× slower |
| Load the collection, 256 documents per commit | 10,000 | 319.25 | n/a | 241.57 | 1.3× slower |
| Read one document by ID | 100,000 | 0.014 | 0.120 | n/a | 8.8× faster |
| One tenant's top 20 documents | 100,000 | 0.417 / 0.252 | 0.338 | n/a | 1.3× faster |
| Count one tenant's upper score half | 100,000 | 0.449 | 0.464 | n/a | 1.0× faster |
| Count and sum by region, full scan | 100,000 | 94.27 / 21.33 | 27.58 | n/a | 1.3× faster |
| Count and sum by region, repeated | 100,000 | 0.026 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 3.99 | 0.255 | 3.96 | 1.0× slower |
| Update one document, 32 concurrent writers | 100,000 | 0.165 | 0.036 | 0.268 | 1.6× faster |
| Insert 64 documents in one commit | 100,000 | 4.78 | 0.702 | 4.41 | 1.1× slower |
| Load the collection, 256 documents per commit | 100,000 | 2887.52 | n/a | 2590.92 | 1.1× slower |

### Bun 1.4.4

| Operation | Documents | defuss-db (ms) | MongoDB `w: 1` (ms) | MongoDB `j: true` (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.020 | 0.131 | n/a | 6.5× faster |
| One tenant's top 20 documents | 10,000 | 1.25 / 0.853 | 0.325 | n/a | 2.6× slower |
| Count one tenant's upper score half | 10,000 | 1.88 | 0.485 | n/a | 3.9× slower |
| Count and sum by region, full scan | 10,000 | 31.09 / 21.83 | 3.32 | n/a | 6.6× slower |
| Count and sum by region, repeated | 10,000 | 0.037 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 4.01 | 0.258 | 3.98 | 1.0× slower |
| Update one document, 32 concurrent writers | 10,000 | 0.164 | 0.032 | 0.266 | 1.6× faster |
| Insert 64 documents in one commit | 10,000 | 4.59 | 0.876 | 4.20 | 1.1× slower |
| Load the collection, 256 documents per commit | 10,000 | 276.67 | n/a | 227.72 | 1.2× slower |
| Read one document by ID | 100,000 | 0.023 | 0.102 | n/a | 4.5× faster |
| One tenant's top 20 documents | 100,000 | 0.474 / 0.322 | 0.487 | n/a | 1.5× faster |
| Count one tenant's upper score half | 100,000 | 0.812 | 0.690 | n/a | 1.2× slower |
| Count and sum by region, full scan | 100,000 | 56.74 / 19.19 | 26.55 | n/a | 1.4× faster |
| Count and sum by region, repeated | 100,000 | 0.034 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 4.00 | 0.248 | 4.00 | 1.0× slower |
| Update one document, 32 concurrent writers | 100,000 | 0.167 | 0.035 | 0.269 | 1.6× faster |
| Insert 64 documents in one commit | 100,000 | 4.81 | 0.755 | 4.08 | 1.2× slower |
| Load the collection, 256 documents per commit | 100,000 | 2748.96 | n/a | 2167.00 | 1.3× slower |

The top-20 row lists two defuss-db read paths: the query API first, then `pageByIndex()`. The full-scan aggregate row lists one thread first, then 8 query worker threads (`openDirectory(path, { parallel: true })`, with exact sums so the partial results merge). Each comparison uses the faster path. The repeated aggregate reuses the defuss-db result cache, which a later commit to the collection invalidates; MongoDB has no result cache to compare with.

The defuss-db load includes the background compaction that ran while it loaded. Reads start after the compaction that follows the last commit has finished: at 10,000 documents it finished 1.0 s after the last commit, after 0 copies that reclaimed 0 MiB, and left 3 MiB on disk; at 100,000 documents it finished 1.3 s after the last commit, after 2 copies that reclaimed 4 MiB, and left 28 MiB on disk (Node.js).

Reads run on warm caches: before any read is timed, each system scans the whole collection and walks the whole compound index once. At 100,000 documents defuss-db then held 4 MiB of decoded tree pages in 9,092 cache entries, including pages of generations that background compaction had replaced; it does not cache document values, which it reads from the file and decodes on every scan. MongoDB's WiredTiger cache held 52 MiB of its 24,064 MiB limit (Node.js run).

A 4 KiB write followed by a defuss-storage flush took 4.06 ms under Node.js and 4.12 ms under Bun on the benchmark machine. On macOS, defuss-storage asks the drive to empty its write cache (`F_FULLFSYNC`) under both runtimes, as MongoDB `j: true` waits for its journal flush.

This standalone MongoDB server rejected a multi-document transaction with the error "Transaction numbers are only allowed on a replica set member or mongos" defuss-db committed two collections in one transaction on the same directory storage.

## Ranked search

Search returns five ranked documents from 256 articles. Full-text search uses BM25. Vector search uses exact cosine similarity on supplied eight-dimensional embeddings. Hybrid search combines both signals. All three timings include document lookup with a warm search engine. The first search after reopening rebuilds its engine from stored inputs and has a separate cost. [Search indexes](SEARCH.md)

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Search for five documents | Warm lexical engine | 0.162 | 0.079 | 0.121 | 0.121 |
| Search for five documents | Warm vector engine | 0.097 | 0.090 | 0.166 | 0.113 |
| Search for five documents | Warm hybrid engine | 0.241 | 0.159 | 0.311 | 0.242 |

## Reopen a file-backed database

Each sample opens an existing database from its Node or Bun directory, reads a known event by ID and closes the handle. All earlier handles are already closed. The process stays alive and the OS filesystem cache is warm. The browser playground demonstrates persistence separately through OPFS in a dedicated worker.

| Runtime | Directory open + read + close (ms) |
| --- | ---: |
| Node | 10.70 |
| Bun | 13.05 |

## Document reads, history and writes

The temporal fixture starts with 256 documents, four effective versions per ID and a 512-byte binary field. Current writes commit one document. Backdated edits change a closed interval. A cold historical page builds index postings for its slice. A warm page reuses those postings. The OS cache is warm in both cases. Live ordered pages use the 4,096-event fixture.

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Current document | Untracked collection | 0.010 | 0.010 | 0.018 | 0.011 |
| Current document | Tracked collection | 0.010 | 0.010 | 0.017 | 0.010 |
| Historical document | Effective date | 0.031 | 0.093 | 0.032 | 0.043 |
| Historical document | Effective date and recorded cutoff | 0.042 | 0.068 | 0.063 | 0.098 |
| Commit one update | Untracked collection | 0.114 | 4.04 | 0.126 | 4.04 |
| Commit one update | Tracked collection | 0.149 | 3.98 | 0.171 | 4.01 |
| Correct a closed interval | One document | 0.209 | 4.07 | 0.361 | 4.04 |
| Delete a closed interval | One document | 0.237 | 4.02 | 0.225 | 4.04 |
| Count historical documents | Full scan | 8.90 | 29.83 | 8.03 | 19.86 |
| Count historical documents | Warm result cache | 0.100 | 0.190 | 0.122 | 0.130 |
| Historical page of 32 IDs | Build postings and read page | 8.80 | 27.58 | 8.72 | 20.92 |
| Historical page of 32 IDs | Read retained postings | 0.105 | 0.046 | 0.064 | 0.044 |
| Ordered page of 20 IDs | Live index | 0.130 | 0.442 | 0.118 | 0.397 |
| Ordered page of 20 documents | Live index and document lookup | 0.192 | 0.645 | 0.215 | 0.460 |
| Count 64 index entries | Live index | 0.286 | 1.24 | 0.276 | 1.10 |

## Rows already in memory

For an application that already owns its decoded objects and needs a projection or aggregate, raw DataView can query the array directly. Use the database when the collection also needs maintained indexes, atomic edits, pinned reads, ranked search or history.

This memory-only experiment runs the same prepared DataView projection or aggregate over 4,096 records in one process. One source is an immutable resident JavaScript array. The other is an in-memory defuss-db collection with encoded documents and snapshot reads. Both return identical fields, groups and ordering. Result caching is disabled. The projected page returns ID and score for one tenant. The aggregate counts all events and sums scores for 16 regions. Record creation and loading are excluded.

| Runtime | Query | In-memory defuss-db (ms) | Resident DataView array (ms) | Rows examined, DB / array |
| --- | --- | ---: | ---: | ---: |
| Node | Top 20 projected scores | 0.336 | 0.160 | 21 / 4096 |
| Node | Count and sum by region | 9.25 | 0.436 | 4096 / 4096 |
| Bun | Top 20 projected scores | 0.383 | 0.220 | 21 / 4096 |
| Bun | Count and sum by region | 7.16 | 0.328 | 4096 / 4096 |

## Reproduce the measurements

Run `make bench-workloads` for the defuss-db workloads and `make bench-mongo` for the MongoDB comparison; the latter reads `MONGODB_URL`, creates a throwaway database and drops it afterwards. Values are medians of seven samples after two warmups. Each series starts once background compaction from earlier writes has finished; in the MongoDB comparison, the collection load includes it. Paired paths alternate order. Each runtime runs separately, one client at a time, except for the 32 concurrent writers. Timings are milliseconds per operation. For repeated point reads and single-document writes, each sample is elapsed time divided by its call count. A collection load is measured once. The JSON records every sample, iteration count and selected query plan.

- Node v26.13.1 on darwin arm64, Apple M5 Max.
- Bun 1.4.4 on darwin arm64, Apple M5 Max.
- MongoDB 9.0.8 (wiredTiger, standalone: yes) on the same machine.
- One-minute host load average during the MongoDB comparison (Node.js): 6.1 at the start and 11.5 at the end, on 18 cores; other processes on the host share them.

[Node samples](benchmarks/workloads-node.json) · [Bun samples](benchmarks/workloads-bun.json) · [MongoDB comparison, Node](benchmarks/mongodb-node.json) · [MongoDB comparison, Bun](benchmarks/mongodb-bun.json)
