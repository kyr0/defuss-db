# Query, search and storage benchmarks

## A compound index for a tenant feed

Return the 20 highest-scoring events for one tenant. The collection has 4,096 events, 64 tenants and 64 events per tenant. Both paths query the same collection at the same revision on the same backend. Both return complete event documents in identical order. A JavaScript filter and sort verifies every result outside the timed interval.

The ordered index stores tenant ascending and score descending. Equality on the first field lets the database seek directly to the tenant. The remaining keys are already in score order, so the reader stops after 20 events and one lookahead. The collection scan reads all events, filters and orders the matches. The query uses the same page size, snapshot acquisition and count mode on both paths. Result caching is disabled. Plans and indexes are prepared before timing.

| Runtime | Storage for both paths | Compound index (ms) | Collection scan (ms) | Rows examined, index / scan |
| --- | --- | ---: | ---: | ---: |
| Node | memory | 0.584 | 9.28 | 21 / 4096 |
| Node | directory | 1.46 | 24.18 | 21 / 4096 |
| Bun | memory | 0.690 | 8.52 | 21 / 4096 |
| Bun | directory | 1.60 | 24.81 | 21 / 4096 |

### What the index costs on writes

Each pair commits the same batch of 64 new events to two collections on the same database. Both start with 4,096 identical events and maintain primary keys. One also maintains the tenant–score index. Every round inserts fresh IDs. Each latency covers the full batch and commit. The initial index build is outside these timings.

| Runtime | Storage for both collections | With compound index (ms) | Primary keys only (ms) |
| --- | --- | ---: | ---: |
| Node | memory | 1.51 | 0.516 |
| Node | directory | 5.90 | 4.46 |
| Bun | memory | 1.25 | 0.437 |
| Bun | directory | 5.09 | 4.08 |

## Compared with MongoDB on one machine

Both systems run on the same machine and hold the same documents: a numeric ID, one of 64 tenants, one of 16 regions, a unique score, a Date and a short label. Both maintain the same compound index on tenant ascending and score descending. defuss-db runs inside the benchmark process on directory storage. MongoDB 9.0.8 runs as a standalone wiredTiger server and is reached over loopback TCP through the official driver 7.8.0. Each run measures 10,000 and 100,000 documents. Every timed result is compared with the other system and with a JavaScript oracle outside the timed interval.

A defuss-db write returns after its commit is flushed to the storage device. MongoDB with the default write concern (`w: 1`) acknowledges a write before its journal is flushed. With `j: true` it waits for the journal flush, which makes it the durability match for defuss-db writes. Read operations have no journal column. The last column compares defuss-db reads with MongoDB `w: 1` and defuss-db writes with MongoDB `j: true`.

### Node.js 26.13.1

| Operation | Documents | defuss-db (ms) | MongoDB `w: 1` (ms) | MongoDB `j: true` (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.017 | 0.148 | n/a | 8.8× faster |
| One tenant's top 20 documents | 10,000 | 1.09 / 0.646 | 0.400 | n/a | 1.6× slower |
| Count one tenant's upper score half | 10,000 | 1.76 | 0.379 | n/a | 4.6× slower |
| Count and sum by region, full scan | 10,000 | 34.00 / 13.92 | 6.16 | n/a | 2.3× slower |
| Count and sum by region, repeated | 10,000 | 0.029 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 4.01 | 0.253 | 4.01 | 1.0× faster |
| Update one document, 32 concurrent writers | 10,000 | 0.189 | 0.043 | 0.284 | 1.5× faster |
| Insert 64 documents in one commit | 10,000 | 7.35 | 0.989 | 4.78 | 1.5× slower |
| Load the collection, 256 documents per commit | 10,000 | 373.96 | n/a | 243.66 | 1.5× slower |
| Read one document by ID | 100,000 | 0.015 | 0.124 | n/a | 8.1× faster |
| One tenant's top 20 documents | 100,000 | 0.461 / 0.331 | 0.514 | n/a | 1.6× faster |
| Count one tenant's upper score half | 100,000 | 0.581 | 0.513 | n/a | 1.1× slower |
| Count and sum by region, full scan | 100,000 | 98.61 / 23.72 | 30.65 | n/a | 1.3× faster |
| Count and sum by region, repeated | 100,000 | 0.019 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 4.00 | 0.246 | 4.01 | 1.0× faster |
| Update one document, 32 concurrent writers | 100,000 | 0.187 | 0.036 | 0.287 | 1.5× faster |
| Insert 64 documents in one commit | 100,000 | 5.99 | 0.864 | 4.82 | 1.2× slower |
| Load the collection, 256 documents per commit | 100,000 | 4489.22 | n/a | 2242.86 | 2.0× slower |

### Bun 1.4.4

| Operation | Documents | defuss-db (ms) | MongoDB `w: 1` (ms) | MongoDB `j: true` (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.026 | 0.147 | n/a | 5.7× faster |
| One tenant's top 20 documents | 10,000 | 1.59 / 0.819 | 0.401 | n/a | 2.0× slower |
| Count one tenant's upper score half | 10,000 | 1.76 | 0.456 | n/a | 3.9× slower |
| Count and sum by region, full scan | 10,000 | 33.60 / 21.12 | 3.71 | n/a | 5.7× slower |
| Count and sum by region, repeated | 10,000 | 0.034 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 4.00 | 0.246 | 4.00 | 1.0× faster |
| Update one document, 32 concurrent writers | 10,000 | 0.195 | 0.034 | 0.280 | 1.4× faster |
| Insert 64 documents in one commit | 10,000 | 5.85 | 0.960 | 4.69 | 1.2× slower |
| Load the collection, 256 documents per commit | 10,000 | 323.26 | n/a | 239.83 | 1.3× slower |
| Read one document by ID | 100,000 | 0.020 | 0.116 | n/a | 5.8× faster |
| One tenant's top 20 documents | 100,000 | 0.332 / 0.257 | 0.328 | n/a | 1.3× faster |
| Count one tenant's upper score half | 100,000 | 0.466 | 0.381 | n/a | 1.2× slower |
| Count and sum by region, full scan | 100,000 | 55.48 / 21.81 | 28.39 | n/a | 1.3× faster |
| Count and sum by region, repeated | 100,000 | 0.030 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 4.00 | 0.281 | 3.97 | 1.0× slower |
| Update one document, 32 concurrent writers | 100,000 | 0.182 | 0.034 | 0.283 | 1.6× faster |
| Insert 64 documents in one commit | 100,000 | 5.94 | 1.01 | 4.82 | 1.2× slower |
| Load the collection, 256 documents per commit | 100,000 | 4129.83 | n/a | 2267.63 | 1.8× slower |

The top-20 row lists two defuss-db read paths: the query API first, then `pageByIndex()`. The full-scan aggregate row lists one thread first, then 8 query worker threads (`openDirectory(path, { parallel: true })`, with exact sums so the partial results merge). Each comparison uses the faster path. The repeated aggregate reuses the defuss-db result cache, which a later commit to the collection invalidates; MongoDB has no result cache to compare with.

The defuss-db load includes the background compaction that ran while it loaded. Reads start after the compaction that follows the last commit has finished: at 10,000 documents it finished 1.0 s after the last commit, after 0 copies that reclaimed 0 MiB, and left 7 MiB on disk; at 100,000 documents it finished 4.9 s after the last commit, after 2 copies that reclaimed 82 MiB, and left 28 MiB on disk (Node.js).

Reads run on warm caches: before any read is timed, each system scans the whole collection and walks the whole compound index once. At 100,000 documents defuss-db then held 9 MiB of decoded tree pages in 15,975 cache entries, including pages of generations that background compaction had replaced; it does not cache document values, which it reads from the file and decodes on every scan. MongoDB's WiredTiger cache held 52 MiB of its 24,064 MiB limit (Node.js run).

A 4 KiB write followed by a defuss-storage flush took 4.02 ms under Node.js and 4.16 ms under Bun on the benchmark machine. On macOS, defuss-storage asks the drive to empty its write cache (`F_FULLFSYNC`) under both runtimes, as MongoDB `j: true` waits for its journal flush.

This standalone MongoDB server rejected a multi-document transaction with the error "Transaction numbers are only allowed on a replica set member or mongos" defuss-db committed two collections in one transaction on the same directory storage.

## Ranked search

Search returns five ranked documents from 256 articles. Full-text search uses BM25. Vector search uses exact cosine similarity on supplied eight-dimensional embeddings. Hybrid search combines both signals. All three timings include document lookup with a warm search engine. The first search after reopening rebuilds its engine from stored inputs and has a separate cost. [Search indexes](SEARCH.md)

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Search for five documents | Warm lexical engine | 0.111 | 0.092 | 0.160 | 0.212 |
| Search for five documents | Warm vector engine | 0.138 | 0.094 | 0.113 | 0.262 |
| Search for five documents | Warm hybrid engine | 0.226 | 0.226 | 0.269 | 0.205 |

## Reopen a file-backed database

Each sample opens an existing database from its Node or Bun directory, reads a known event by ID and closes the handle. All earlier handles are already closed. The process stays alive and the OS filesystem cache is warm. The browser playground demonstrates persistence separately through OPFS in a dedicated worker.

| Runtime | Directory open + read + close (ms) |
| --- | ---: |
| Node | 1.18 |
| Bun | 0.896 |

## Document reads, history and writes

The temporal fixture starts with 256 documents, four effective versions per ID and a 512-byte binary field. Current writes commit one document. Backdated edits change a closed interval. A cold historical page builds index postings for its slice. A warm page reuses those postings. The OS cache is warm in both cases. Live ordered pages use the 4,096-event fixture.

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Current document | Untracked collection | 0.013 | 0.012 | 0.019 | 0.020 |
| Current document | Tracked collection | 0.013 | 0.011 | 0.019 | 0.019 |
| Historical document | Effective date | 0.029 | 0.044 | 0.044 | 0.068 |
| Historical document | Effective date and recorded cutoff | 0.065 | 0.089 | 0.083 | 0.088 |
| Commit one update | Untracked collection | 0.142 | 4.02 | 0.195 | 4.03 |
| Commit one update | Tracked collection | 0.300 | 4.03 | 0.314 | 4.01 |
| Correct a closed interval | One document | 0.349 | 4.00 | 0.433 | 4.05 |
| Delete a closed interval | One document | 0.278 | 4.03 | 0.328 | 4.08 |
| Count historical documents | Full scan | 12.19 | 27.55 | 9.69 | 26.50 |
| Count historical documents | Warm result cache | 0.123 | 0.205 | 0.154 | 0.144 |
| Historical page of 32 IDs | Build postings and read page | 9.85 | 23.98 | 8.52 | 21.04 |
| Historical page of 32 IDs | Read retained postings | 0.046 | 0.049 | 0.071 | 0.057 |
| Ordered page of 20 IDs | Live index | 0.182 | 0.274 | 0.149 | 0.539 |
| Ordered page of 20 documents | Live index and document lookup | 0.296 | 0.460 | 0.217 | 0.542 |
| Count 64 index entries | Live index | 0.309 | 1.03 | 0.294 | 1.46 |

## Rows already in memory

For an application that already owns its decoded objects and needs a projection or aggregate, raw DataView can query the array directly. Use the database when the collection also needs maintained indexes, atomic edits, pinned reads, ranked search or history.

This memory-only experiment runs the same prepared DataView projection or aggregate over 4,096 records in one process. One source is an immutable resident JavaScript array. The other is an in-memory defuss-db collection with encoded documents and snapshot reads. Both return identical fields, groups and ordering. Result caching is disabled. The projected page returns ID and score for one tenant. The aggregate counts all events and sums scores for 16 regions. Record creation and loading are excluded.

| Runtime | Query | In-memory defuss-db (ms) | Resident DataView array (ms) | Rows examined, DB / array |
| --- | --- | ---: | ---: | ---: |
| Node | Top 20 projected scores | 0.464 | 0.153 | 21 / 4096 |
| Node | Count and sum by region | 9.77 | 0.501 | 4096 / 4096 |
| Bun | Top 20 projected scores | 0.414 | 0.205 | 21 / 4096 |
| Bun | Count and sum by region | 7.47 | 0.463 | 4096 / 4096 |

## Reproduce the measurements

Run `make bench-workloads` for the defuss-db workloads and `make bench-mongo` for the MongoDB comparison; the latter reads `MONGODB_URL`, creates a throwaway database and drops it afterwards. Values are medians of seven samples after two warmups. Each series starts once background compaction from earlier writes has finished; in the MongoDB comparison, the collection load includes it. Paired paths alternate order. Each runtime runs separately, one client at a time, except for the 32 concurrent writers. Timings are milliseconds per operation. For repeated point reads and single-document writes, each sample is elapsed time divided by its call count. A collection load is measured once. The JSON records every sample, iteration count and selected query plan.

- Node v26.13.1 on darwin arm64, Apple M5 Max.
- Bun 1.4.4 on darwin arm64, Apple M5 Max.
- MongoDB 9.0.8 (wiredTiger, standalone: yes) on the same machine.
- One-minute host load average during the MongoDB comparison (Node.js): 8.0 at the start and 8.6 at the end, on 18 cores; other processes on the host share them.

[Node samples](benchmarks/workloads-node.json) · [Bun samples](benchmarks/workloads-bun.json) · [MongoDB comparison, Node](benchmarks/mongodb-node.json) · [MongoDB comparison, Bun](benchmarks/mongodb-bun.json)
