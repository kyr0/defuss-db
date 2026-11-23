# Query, search and storage benchmarks

## A compound index for a tenant feed

Return the 20 highest-scoring events for one tenant. The collection has 4,096 events, 64 tenants and 64 events per tenant. Both paths query the same collection at the same revision on the same backend. Both return complete event documents in identical order. A JavaScript filter and sort verifies every result outside the timed interval.

The ordered index stores tenant ascending and score descending. Equality on the first field lets the database seek directly to the tenant. The remaining keys are already in score order, so the reader stops after 20 events and one lookahead. The collection scan reads all events, filters and orders the matches. The query uses the same page size, snapshot acquisition and count mode on both paths. Result caching is disabled. Plans and indexes are prepared before timing.

| Runtime | Storage for both paths | Compound index (ms) | Collection scan (ms) | Rows examined, index / scan |
| --- | --- | ---: | ---: | ---: |
| Node | memory | 0.264 | 3.62 | 21 / 4096 |
| Node | directory | 0.231 | 3.70 | 21 / 4096 |
| Bun | memory | 0.309 | 3.31 | 21 / 4096 |
| Bun | directory | 0.296 | 4.18 | 21 / 4096 |

### What the index costs on writes

Each pair commits the same batch of 64 new events to two collections on the same database. Both start with 4,096 identical events and maintain primary keys. One also maintains the tenant–score index. Every round inserts fresh IDs. Each latency covers the full batch and commit. The initial index build is outside these timings.

| Runtime | Storage for both collections | With compound index (ms) | Primary keys only (ms) |
| --- | --- | ---: | ---: |
| Node | memory | 0.662 | 0.373 |
| Node | directory | 4.08 | 3.93 |
| Bun | memory | 0.520 | 0.301 |
| Bun | directory | 4.07 | 3.93 |

## Compared with MongoDB on one machine

Both systems run on the same machine and hold the same documents: a numeric ID, one of 64 tenants, one of 16 regions, a unique score, a Date and a short label. Both maintain the same compound index on tenant ascending and score descending. defuss-db runs inside the benchmark process on directory storage. MongoDB 9.0.8 runs as a standalone wiredTiger server and is reached over loopback TCP through the official driver 7.8.0. Each run measures 10,000 and 100,000 documents. Every timed result is compared with the other system and with a JavaScript oracle outside the timed interval.

A defuss-db write returns after its commit is flushed to the storage device. MongoDB with the default write concern (`w: 1`) acknowledges a write before its journal is flushed. With `j: true` it waits for the journal flush, which makes it the durability match for defuss-db writes. Read operations have no journal column. The last column compares defuss-db reads with MongoDB `w: 1` and defuss-db writes with MongoDB `j: true`.

Each run measures both systems in the same rounds, back to back and in alternating order, so load from other processes on the host hits both alike: 7 rounds after 2 warmups, and 5 for bulk loads, each into a fresh store and collection. The last column gives the geometric mean of the per-round time ratios with its 95% confidence interval (Student's t on the log ratios). It names a faster or slower system only when the whole interval lies on one side of 1, and reads "no clear difference" otherwise. The interval covers the variation within one run, not between runs on a host under different load.

### Node.js 26.13.1

| Operation | Documents | defuss-db median (ms) | MongoDB `w: 1` median (ms) | MongoDB `j: true` median (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.012 | 0.088 | n/a | 8.6× faster (95% CI 7.0–10.6×) |
| One tenant's top 20 documents | 10,000 | 0.349 / 0.191 | 0.218 | n/a | no clear difference (95% CI 0.74–1.40× the time) |
| Count one tenant's upper score half | 10,000 | 0.109 | 0.177 | n/a | 1.71× faster (95% CI 1.41–2.1×) |
| Count and sum by region, full scan | 10,000 | 11.49 / 3.35 | 2.48 | n/a | no clear difference (95% CI 0.70–1.84× the time) |
| Count and sum by region, repeated | 10,000 | 0.027 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 3.99 | 0.166 | 3.92 | no clear difference (95% CI 1.00–1.07× the time) |
| Update one document, 32 concurrent writers | 10,000 | 0.156 | 0.027 | 0.234 | 1.36× faster (95% CI 1.14–1.62×) |
| Insert 64 documents in one commit | 10,000 | 4.15 | 0.648 | 4.10 | no clear difference (95% CI 0.71–1.21× the time) |
| Load the collection, 256 documents per commit | 10,000 | 292.04 | n/a | 202.45 | 1.48× slower (95% CI 1.36–1.62×) |
| Read one document by ID | 100,000 | 0.010 | 0.089 | n/a | 8.0× faster (95% CI 6.4–10.0×) |
| One tenant's top 20 documents | 100,000 | 0.288 / 0.186 | 0.189 | n/a | no clear difference (95% CI 0.68–1.09× the time) |
| Count one tenant's upper score half | 100,000 | 0.343 | 0.286 | n/a | no clear difference (95% CI 0.87–1.37× the time) |
| Count and sum by region, full scan | 100,000 | 86.02 / 22.82 | 20.26 | n/a | no clear difference (95% CI 0.68–1.61× the time) |
| Count and sum by region, repeated | 100,000 | 0.018 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 3.94 | 0.180 | 3.90 | no clear difference (95% CI 0.92–1.08× the time) |
| Update one document, 32 concurrent writers | 100,000 | 0.153 | 0.026 | 0.271 | 1.77× faster (95% CI 1.67–1.87×) |
| Insert 64 documents in one commit | 100,000 | 4.61 | 0.508 | 3.91 | no clear difference (95% CI 0.95–1.22× the time) |
| Load the collection, 256 documents per commit | 100,000 | 2506.45 | n/a | 2023.75 | 1.24× slower (95% CI 1.20–1.28×) |

### Bun 1.4.4

| Operation | Documents | defuss-db median (ms) | MongoDB `w: 1` median (ms) | MongoDB `j: true` median (ms) | defuss-db compared with MongoDB |
| --- | ---: | ---: | ---: | ---: | --- |
| Read one document by ID | 10,000 | 0.021 | 0.093 | n/a | 4.2× faster (95% CI 2.9–6.0×) |
| One tenant's top 20 documents | 10,000 | 0.398 / 0.246 | 0.227 | n/a | no clear difference (95% CI 0.81–1.43× the time) |
| Count one tenant's upper score half | 10,000 | 0.133 | 0.193 | n/a | 1.53× faster (95% CI 1.15–2.0×) |
| Count and sum by region, full scan | 10,000 | 9.89 / 7.19 | 2.68 | n/a | 2.3× slower (95% CI 1.64–3.2×) |
| Count and sum by region, repeated | 10,000 | 0.034 | n/a | n/a | no MongoDB equivalent |
| Update one document | 10,000 | 3.99 | 0.174 | 4.00 | no clear difference (95% CI 0.97–1.03× the time) |
| Update one document, 32 concurrent writers | 10,000 | 0.156 | 0.028 | 0.265 | 1.66× faster (95% CI 1.57–1.76×) |
| Insert 64 documents in one commit | 10,000 | 3.87 | 0.490 | 3.79 | no clear difference (95% CI 0.89–1.18× the time) |
| Load the collection, 256 documents per commit | 10,000 | 280.28 | n/a | 199.71 | 1.37× slower (95% CI 1.12–1.67×) |
| Read one document by ID | 100,000 | 0.019 | 0.084 | n/a | 4.0× faster (95% CI 3.2–5.1×) |
| One tenant's top 20 documents | 100,000 | 0.315 / 0.206 | 0.243 | n/a | no clear difference (95% CI 0.69–1.17× the time) |
| Count one tenant's upper score half | 100,000 | 0.464 | 0.284 | n/a | 1.56× slower (95% CI 1.22–2.00×) |
| Count and sum by region, full scan | 100,000 | 57.16 / 18.02 | 19.31 | n/a | no clear difference (95% CI 0.73–1.20× the time) |
| Count and sum by region, repeated | 100,000 | 0.032 | n/a | n/a | no MongoDB equivalent |
| Update one document | 100,000 | 3.48 | 0.168 | 3.75 | no clear difference (95% CI 0.89–1.03× the time) |
| Update one document, 32 concurrent writers | 100,000 | 0.156 | 0.027 | 0.242 | 1.55× faster (95% CI 1.43–1.67×) |
| Insert 64 documents in one commit | 100,000 | 3.84 | 0.511 | 3.77 | no clear difference (95% CI 0.91–1.37× the time) |
| Load the collection, 256 documents per commit | 100,000 | 2470.94 | n/a | 1960.69 | 1.26× slower (95% CI 1.22–1.29×) |

The top-20 row lists two defuss-db read paths: the query API first, then `pageByIndex()`. The full-scan aggregate row lists one thread first, then 8 query worker threads (`openDirectory(path, { parallel: true })`, with exact sums so the partial results merge). Each comparison uses the faster path. The repeated aggregate reuses the defuss-db result cache, which a later commit to the collection invalidates; MongoDB has no result cache to compare with.

The defuss-db load includes the background compaction that ran while it loaded. Reads start after the compaction that follows the first load round has finished: at 10,000 documents it finished 1.0 s after the last commit, after 2 copies that reclaimed 0 MiB, and left 3 MiB on disk; at 100,000 documents it finished 1.2 s after the last commit, after 2 copies that reclaimed 3 MiB, and left 28 MiB on disk (first Node.js run).

Reads run on warm caches: before any read is timed, each system scans the whole collection and walks the whole compound index once. At 100,000 documents defuss-db then held 3 MiB of decoded tree pages in 6,828 cache entries, including pages of generations that background compaction had replaced; it does not cache document values, which it reads from the file and decodes on every scan. MongoDB's WiredTiger cache held 69 MiB of its 24,064 MiB limit (first Node.js run).

A 4 KiB write followed by a defuss-storage flush took 3.91 ms under Node.js and 3.86 ms under Bun on the benchmark machine, each in the run with the fastest flush. On macOS, defuss-storage asks the drive to empty its write cache (`F_FULLFSYNC`) under both runtimes, as MongoDB `j: true` waits for its journal flush.

This standalone MongoDB server rejected a multi-document transaction with the error "Transaction numbers are only allowed on a replica set member or mongos" defuss-db committed two collections in one transaction on the same directory storage.

## Ranked search

Search returns five ranked documents from 256 articles. Full-text search uses BM25. Vector search uses exact cosine similarity on supplied eight-dimensional embeddings. Hybrid search combines both signals. All three timings include document lookup with a warm search engine. The first search after reopening rebuilds its engine from stored inputs and has a separate cost. [Search indexes](SEARCH.md)

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Search for five documents | Warm lexical engine | 0.119 | 0.071 | 0.117 | 0.077 |
| Search for five documents | Warm vector engine | 0.085 | 0.101 | 0.112 | 0.098 |
| Search for five documents | Warm hybrid engine | 0.216 | 0.174 | 0.191 | 0.161 |

## Reopen a file-backed database

Each sample opens an existing database from its Node or Bun directory, reads a known event by ID and closes the handle. All earlier handles are already closed. The process stays alive and the OS filesystem cache is warm. The browser playground demonstrates persistence separately through OPFS in a dedicated worker.

| Runtime | Directory open + read + close (ms) |
| --- | ---: |
| Node | 3.89 |
| Bun | 4.14 |

## Document reads, history and writes

The temporal fixture starts with 256 documents, four effective versions per ID and a 512-byte binary field. Current writes commit one document. Backdated edits change a closed interval. A cold historical page builds index postings for its slice. A warm page reuses those postings. The OS cache is warm in both cases. Live ordered pages use the 4,096-event fixture.

| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| Current document | Untracked collection | 0.008 | 0.009 | 0.009 | 0.009 |
| Current document | Tracked collection | 0.008 | 0.010 | 0.010 | 0.009 |
| Historical document | Effective date | 0.023 | 0.036 | 0.029 | 0.040 |
| Historical document | Effective date and recorded cutoff | 0.036 | 0.058 | 0.039 | 0.064 |
| Commit one update | Untracked collection | 0.104 | 4.05 | 0.089 | 3.97 |
| Commit one update | Tracked collection | 0.157 | 3.95 | 0.138 | 3.99 |
| Correct a closed interval | One document | 0.165 | 4.00 | 0.180 | 3.97 |
| Delete a closed interval | One document | 0.124 | 4.00 | 0.127 | 3.98 |
| Count historical documents | Full scan | 1.98 | 9.30 | 2.50 | 9.05 |
| Count historical documents | Warm result cache | 0.056 | 0.096 | 0.065 | 0.088 |
| Historical page of 32 IDs | Build postings and read page | 1.78 | 8.28 | 1.68 | 7.98 |
| Historical page of 32 IDs | Read retained postings | 0.031 | 0.041 | 0.045 | 0.034 |
| Ordered page of 20 IDs | Live index | 0.034 | 0.047 | 0.043 | 0.065 |
| Ordered page of 20 documents | Live index and document lookup | 0.114 | 0.122 | 0.125 | 0.135 |
| Count 64 index entries | Live index | 0.045 | 0.064 | 0.055 | 0.079 |

## Rows already in memory

For an application that already owns its decoded objects and needs a projection or aggregate, raw DataView can query the array directly. Use the database when the collection also needs maintained indexes, atomic edits, pinned reads, ranked search or history.

This memory-only experiment runs the same prepared DataView projection or aggregate over 4,096 records in one process. One source is an immutable resident JavaScript array. The other is an in-memory defuss-db collection with encoded documents and snapshot reads. Both return identical fields, groups and ordering. Result caching is disabled. The projected page returns ID and score for one tenant. The aggregate counts all events and sums scores for 16 regions. Record creation and loading are excluded.

| Runtime | Query | In-memory defuss-db (ms) | Resident DataView array (ms) | Rows examined, DB / array |
| --- | --- | ---: | ---: | ---: |
| Node | Top 20 projected scores | 0.203 | 0.149 | 21 / 4096 |
| Node | Count and sum by region | 3.16 | 0.238 | 4096 / 4096 |
| Bun | Top 20 projected scores | 0.228 | 0.189 | 21 / 4096 |
| Bun | Count and sum by region | 3.52 | 0.290 | 4096 / 4096 |

## Reproduce the measurements

Run `make bench-runs`. It repeats the MongoDB comparison (`make bench-mongo`, which reads `MONGODB_URL`, creates a throwaway database and drops it afterwards) and the defuss-db workloads (`make bench-workloads`) in 8 separate runs under each runtime. Each workload is published from the run that other processes on the host disturbed least: the run with the lowest geometric mean of that workload's medians. Every path and system of a workload comes from that one run, so their comparison stays paired. Values are medians of seven samples after two warmups in that run. Each series starts once background compaction from earlier writes has finished; in the MongoDB comparison, the collection load includes it. Paired paths alternate order. Each runtime runs separately, one client at a time, except for the 32 concurrent writers. Timings are milliseconds per operation. For repeated point reads and single-document writes, each sample is elapsed time divided by its call count. A collection load has no warmup: each of its 5 rounds loads a fresh store once. The JSON records every sample, iteration count, selected query plan and the run each result comes from; the repository's `docs/benchmarks/runs/` holds every run.

- Node v26.13.1 on darwin arm64, Apple M5 Max.
- Bun 1.4.4 on darwin arm64, Apple M5 Max.
- defuss-db 3.2.0 with defuss-dataview 0.10.0.
- MongoDB 9.0.8 (wiredTiger, standalone: yes) on the same machine.
- Between the 8 runs, the median of a series differed by a typical factor of 1.4 (Node.js) and 1.6 (Bun) in the defuss-db workloads, and of 1.4 and 1.5 in the MongoDB comparison. The published runs are the least disturbed of them, not undisturbed ones.
- One-minute host load average at the start of the MongoDB comparison runs (Node.js): 2.7 to 10.6, on 18 cores; other processes on the host share them.

[Node samples](benchmarks/workloads-node.json) · [Bun samples](benchmarks/workloads-bun.json) · [MongoDB comparison, Node](benchmarks/mongodb-node.json) · [MongoDB comparison, Bun](benchmarks/mongodb-bun.json)
