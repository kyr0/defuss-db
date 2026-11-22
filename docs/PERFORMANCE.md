# Query, search and storage benchmarks

## A compound index for a tenant feed

Return the 20 highest-scoring events for one tenant. The collection has 4,096 events, 64 tenants and 64 events per tenant. Both paths query the same collection at the same revision on the same backend. Both return complete event documents in identical order. A JavaScript filter and sort verifies every result outside the timed interval.

The ordered index stores tenant ascending and score descending. Equality on the first field lets the database seek directly to the tenant. The remaining keys are already in score order, so the reader stops after 20 events and one lookahead. The collection scan reads all events, filters and orders the matches. The query uses the same page size, snapshot acquisition and count mode on both paths. Result caching is disabled. Plans and indexes are prepared before timing.

| Runtime | Storage for both paths | Compound index (ms) | Collection scan (ms) | Rows examined, index / scan |
| --- | --- | ---: | ---: | ---: |
| Node | memory | 0.340 | 3.78 | 21 / 4096 |
| Node | directory | 0.325 | 3.99 | 21 / 4096 |
| Bun | memory | 0.558 | 4.85 | 21 / 4096 |
| Bun | directory | 0.384 | 4.28 | 21 / 4096 |

### What the index costs on writes

Each pair commits the same batch of 64 new events to two collections on the same database. Both start with 4,096 identical events and maintain primary keys. One also maintains the tenant–score index. Every round inserts fresh IDs. Each latency covers the full batch and commit. The initial index build is outside these timings.

| Runtime | Storage for both collections | With compound index (ms) | Primary keys only (ms) |
| --- | --- | ---: | ---: |
| Node | memory | 0.641 | 0.323 |
| Node | directory | 4.21 | 3.89 |
| Bun | memory | 0.668 | 0.323 |
| Bun | directory | 4.15 | 4.01 |

## Compared with MongoDB on one machine

Both systems run on the same machine and hold the same documents: a numeric ID, one of 64 tenants, one of 16 regions, a unique score, a Date and a short label. Both maintain the same compound index on tenant ascending and score descending. defuss-db runs inside the benchmark process on directory storage. MongoDB 9.0.8 runs as a standalone wiredTiger server and is reached over loopback TCP through the official driver 7.8.0. Each run measures 10,000 and 100,000 documents. Every timed result is compared with the other system and with a JavaScript oracle outside the timed interval.

A defuss-db write returns after its commit is flushed to the storage device. MongoDB with the default write concern (`w: 1`) acknowledges a write before its journal is flushed. With `j: true` it waits for the journal flush, which makes it the durability match for defuss-db writes. Read operations have no journal column. The last column compares defuss-db reads with MongoDB `w: 1` and defuss-db writes with MongoDB `j: true`.

Each run measures both systems in the same rounds, back to back and in alternating order, so load from other processes on the host hits both alike: 7 rounds after 2 warmups, and 5 for bulk loads, each into a fresh store and collection. The last column gives the geometric mean of the per-round time ratios with its 95% confidence interval (Student's t on the log ratios). It names a faster or slower system only when the whole interval lies on one side of 1, and reads "no clear difference" otherwise. The interval covers the variation within one run, not between runs on a host under different load.

### Node.js 26.13.1

| Operation | Documents | defuss-db median (ms) | MongoDB `w: 1` median (ms) | MongoDB `j: true` median (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.012 | 0.123 | n/a | 10.8× faster (95% CI 8.8–13.4×) |
| One tenant's top 20 documents | 10,000 | 0.323 / 0.227 | 0.227 | n/a | no clear difference (95% CI 0.71–1.16× the time) |
| Count one tenant's upper score half | 10,000 | 0.108 | 0.230 | n/a | 2.3× faster (95% CI 1.85–2.8×) |
| Count and sum by region, full scan | 10,000 | 11.31 / 3.46 | 3.63 | n/a | no clear difference (95% CI 0.75–1.83× the time) |
| Count and sum by region, repeated | 10,000 | 0.027 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 3.94 | 0.199 | 3.93 | no clear difference (95% CI 0.98–1.04× the time) |
| Update one document, 32 concurrent writers | 10,000 | 0.155 | 0.030 | 0.258 | 1.64× faster (95% CI 1.54–1.75×) |
| Insert 64 documents in one commit | 10,000 | 4.17 | 0.738 | 4.14 | no clear difference (95% CI 0.90–1.12× the time) |
| Load the collection, 256 documents per commit | 10,000 | 320.74 | n/a | 208.56 | 1.49× slower (95% CI 1.31–1.69×) |
| Read one document by ID | 100,000 | 0.018 | 0.163 | n/a | 8.8× faster (95% CI 6.5–11.9×) |
| One tenant's top 20 documents | 100,000 | 0.440 / 0.332 | 0.449 | n/a | no clear difference (95% CI 0.49–1.00× the time) |
| Count one tenant's upper score half | 100,000 | 0.514 | 0.420 | n/a | no clear difference (95% CI 0.85–1.43× the time) |
| Count and sum by region, full scan | 100,000 | 96.85 / 22.11 | 27.28 | n/a | no clear difference (95% CI 0.79–1.34× the time) |
| Count and sum by region, repeated | 100,000 | 0.029 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 4.00 | 0.249 | 3.99 | no clear difference (95% CI 0.94–1.10× the time) |
| Update one document, 32 concurrent writers | 100,000 | 0.186 | 0.043 | 0.280 | 1.53× faster (95% CI 1.45–1.61×) |
| Insert 64 documents in one commit | 100,000 | 4.80 | 0.586 | 4.34 | no clear difference (95% CI 0.96–1.30× the time) |
| Load the collection, 256 documents per commit | 100,000 | 2567.74 | n/a | 2003.83 | 1.28× slower (95% CI 1.24–1.32×) |

### Bun 1.4.4

| Operation | Documents | defuss-db median (ms) | MongoDB `w: 1` median (ms) | MongoDB `j: true` median (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.021 | 0.107 | n/a | 5.5× faster (95% CI 5.0–6.0×) |
| One tenant's top 20 documents | 10,000 | 0.415 / 0.291 | 0.247 | n/a | no clear difference (95% CI 1.00–1.39× the time) |
| Count one tenant's upper score half | 10,000 | 0.168 | 0.224 | n/a | 1.30× faster (95% CI 1.11–1.52×) |
| Count and sum by region, full scan | 10,000 | 10.69 / 9.11 | 3.89 | n/a | 1.80× slower (95% CI 1.01–3.2×) |
| Count and sum by region, repeated | 10,000 | 0.036 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 3.93 | 0.208 | 3.99 | no clear difference (95% CI 0.93–1.04× the time) |
| Update one document, 32 concurrent writers | 10,000 | 0.171 | 0.030 | 0.243 | 1.48× faster (95% CI 1.35–1.62×) |
| Insert 64 documents in one commit | 10,000 | 4.20 | 0.699 | 3.92 | no clear difference (95% CI 0.74–1.54× the time) |
| Load the collection, 256 documents per commit | 10,000 | 303.04 | n/a | 211.41 | 1.45× slower (95% CI 1.35–1.55×) |
| Read one document by ID | 100,000 | 0.021 | 0.098 | n/a | 4.5× faster (95% CI 3.4–5.9×) |
| One tenant's top 20 documents | 100,000 | 0.323 / 0.214 | 0.218 | n/a | no clear difference (95% CI 0.75–1.62× the time) |
| Count one tenant's upper score half | 100,000 | 0.480 | 0.377 | n/a | no clear difference (95% CI 0.97–2.9× the time) |
| Count and sum by region, full scan | 100,000 | 52.75 / 19.05 | 24.16 | n/a | no clear difference (95% CI 0.63–1.47× the time) |
| Count and sum by region, repeated | 100,000 | 0.032 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 4.00 | 0.218 | 4.13 | no clear difference (95% CI 0.92–1.04× the time) |
| Update one document, 32 concurrent writers | 100,000 | 0.179 | 0.036 | 0.283 | 1.53× faster (95% CI 1.37–1.72×) |
| Insert 64 documents in one commit | 100,000 | 4.29 | 0.731 | 4.41 | no clear difference (95% CI 0.88–1.06× the time) |
| Load the collection, 256 documents per commit | 100,000 | 2542.87 | n/a | 1975.91 | 1.28× slower (95% CI 1.25–1.32×) |

The top-20 row lists two defuss-db read paths: the query API first, then `pageByIndex()`. The full-scan aggregate row lists one thread first, then 8 query worker threads (`openDirectory(path, { parallel: true })`, with exact sums so the partial results merge). Each comparison uses the faster path. The repeated aggregate reuses the defuss-db result cache, which a later commit to the collection invalidates; MongoDB has no result cache to compare with.

The defuss-db load includes the background compaction that ran while it loaded. Reads start after the compaction that follows the first load round has finished: at 10,000 documents it finished 1.1 s after the last commit, after 2 copies that reclaimed 0 MiB, and left 3 MiB on disk; at 100,000 documents it finished 1.3 s after the last commit, after 2 copies that reclaimed 3 MiB, and left 28 MiB on disk (Node.js).

Reads run on warm caches: before any read is timed, each system scans the whole collection and walks the whole compound index once. At 100,000 documents defuss-db then held 3 MiB of decoded tree pages in 6,828 cache entries, including pages of generations that background compaction had replaced; it does not cache document values, which it reads from the file and decodes on every scan. MongoDB's WiredTiger cache held 69 MiB of its 24,064 MiB limit (Node.js run).

A 4 KiB write followed by a defuss-storage flush took 4.09 ms under Node.js and 4.12 ms under Bun on the benchmark machine. On macOS, defuss-storage asks the drive to empty its write cache (`F_FULLFSYNC`) under both runtimes, as MongoDB `j: true` waits for its journal flush.

This standalone MongoDB server rejected a multi-document transaction with the error "Transaction numbers are only allowed on a replica set member or mongos" defuss-db committed two collections in one transaction on the same directory storage.

## Ranked search

Search returns five ranked documents from 256 articles. Full-text search uses BM25. Vector search uses exact cosine similarity on supplied eight-dimensional embeddings. Hybrid search combines both signals. All three timings include document lookup with a warm search engine. The first search after reopening rebuilds its engine from stored inputs and has a separate cost. [Search indexes](SEARCH.md)

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Search for five documents | Warm lexical engine | 0.107 | 0.074 | 0.253 | 0.097 |
| Search for five documents | Warm vector engine | 0.081 | 0.106 | 0.254 | 0.107 |
| Search for five documents | Warm hybrid engine | 0.217 | 0.308 | 0.205 | 0.367 |

## Reopen a file-backed database

Each sample opens an existing database from its Node or Bun directory, reads a known event by ID and closes the handle. All earlier handles are already closed. The process stays alive and the OS filesystem cache is warm. The browser playground demonstrates persistence separately through OPFS in a dedicated worker.

| Runtime | Directory open + read + close (ms) |
| --- | ---: |
| Node | 4.48 |
| Bun | 5.55 |

## Document reads, history and writes

The temporal fixture starts with 256 documents, four effective versions per ID and a 512-byte binary field. Current writes commit one document. Backdated edits change a closed interval. A cold historical page builds index postings for its slice. A warm page reuses those postings. The OS cache is warm in both cases. Live ordered pages use the 4,096-event fixture.

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Current document | Untracked collection | 0.015 | 0.015 | 0.016 | 0.021 |
| Current document | Tracked collection | 0.012 | 0.014 | 0.017 | 0.018 |
| Historical document | Effective date | 0.038 | 0.066 | 0.034 | 0.053 |
| Historical document | Effective date and recorded cutoff | 0.056 | 0.055 | 0.051 | 0.082 |
| Commit one update | Untracked collection | 0.113 | 4.04 | 0.118 | 4.26 |
| Commit one update | Tracked collection | 0.195 | 4.04 | 0.155 | 4.01 |
| Correct a closed interval | One document | 0.166 | 4.02 | 0.365 | 4.02 |
| Delete a closed interval | One document | 0.125 | 4.04 | 0.291 | 4.04 |
| Count historical documents | Full scan | 2.22 | 12.25 | 3.57 | 10.36 |
| Count historical documents | Warm result cache | 0.064 | 0.132 | 0.171 | 0.145 |
| Historical page of 32 IDs | Build postings and read page | 2.11 | 8.81 | 2.62 | 9.67 |
| Historical page of 32 IDs | Read retained postings | 0.039 | 0.049 | 0.056 | 0.056 |
| Ordered page of 20 IDs | Live index | 0.036 | 0.047 | 0.063 | 0.079 |
| Ordered page of 20 documents | Live index and document lookup | 0.115 | 0.120 | 0.165 | 0.171 |
| Count 64 index entries | Live index | 0.045 | 0.076 | 0.187 | 0.109 |

## Rows already in memory

For an application that already owns its decoded objects and needs a projection or aggregate, raw DataView can query the array directly. Use the database when the collection also needs maintained indexes, atomic edits, pinned reads, ranked search or history.

This memory-only experiment runs the same prepared DataView projection or aggregate over 4,096 records in one process. One source is an immutable resident JavaScript array. The other is an in-memory defuss-db collection with encoded documents and snapshot reads. Both return identical fields, groups and ordering. Result caching is disabled. The projected page returns ID and score for one tenant. The aggregate counts all events and sums scores for 16 regions. Record creation and loading are excluded.

| Runtime | Query | In-memory defuss-db (ms) | Resident DataView array (ms) | Rows examined, DB / array |
| --- | --- | ---: | ---: | ---: |
| Node | Top 20 projected scores | 0.221 | 0.177 | 21 / 4096 |
| Node | Count and sum by region | 3.28 | 0.254 | 4096 / 4096 |
| Bun | Top 20 projected scores | 0.408 | 0.274 | 21 / 4096 |
| Bun | Count and sum by region | 4.41 | 0.360 | 4096 / 4096 |

## Reproduce the measurements

Run `make bench-workloads` for the defuss-db workloads and `make bench-mongo` for the MongoDB comparison; the latter reads `MONGODB_URL`, creates a throwaway database and drops it afterwards. Values are medians of seven samples after two warmups. Each series starts once background compaction from earlier writes has finished; in the MongoDB comparison, the collection load includes it. Paired paths alternate order. Each runtime runs separately, one client at a time, except for the 32 concurrent writers. Timings are milliseconds per operation. For repeated point reads and single-document writes, each sample is elapsed time divided by its call count. A collection load is measured once. The JSON records every sample, iteration count and selected query plan.

- Node v26.13.1 on darwin arm64, Apple M5 Max.
- Bun 1.4.4 on darwin arm64, Apple M5 Max.
- defuss-db 3.0.0 with defuss-dataview 0.7.0. 3.1.0 has not been measured again.
- MongoDB 9.0.8 (wiredTiger, standalone: yes) on the same machine.
- One-minute host load average during the MongoDB comparison (Node.js): 7.9 at the start and 9.1 at the end, on 18 cores; other processes on the host share them.

[Node samples](benchmarks/workloads-node.json) · [Bun samples](benchmarks/workloads-bun.json) · [MongoDB comparison, Node](benchmarks/mongodb-node.json) · [MongoDB comparison, Bun](benchmarks/mongodb-bun.json)
