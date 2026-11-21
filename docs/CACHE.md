# Automatic query caching

The database enables cost-aware query caching by default. A result qualifies when its execution scans at least 128 candidate rows, returns at most 25% as many rows, and stays within the configured output-size bound. Second-use admission avoids encoding and retaining one-off results; a third sequential execution can hit. A concurrent repeat can satisfy second-use admission during the first execution. This is a cheap structural heuristic, not a measured CPU-cost model.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const docs = db.collection<{ id: number; category: number; amount: number }>('docs');
await docs.insertMany(Array.from({ length: 512 }, (_, id) => ({
  id, category: id % 8, amount: id,
})));
const q = docs.q;
const totals = {
  groupBy: { category: q.field('category') },
  measures: { count: q.count(), sum: q.sum(q.field('amount')) },
};
await docs.aggregate(totals); // Compile and compute; remember first use.
await docs.aggregate(totals); // Reuse plan, compute, encode and admit.
await docs.aggregate(totals); // Reuse plan; fresh snapshot, then decode cached result.
console.log(db.queryCacheStats());
db.clearQueryCache();
await db.close();
```

`find`, `findOne`, `query`, `select`, `aggregate`, `view`, `count`, and prepared `evaluate` support result caching. `get`/`getMany` retain their direct point-read paths. One-shot primary-key equality queries skip automatic key creation and implicit plan reuse because they cannot meet the minimum scan threshold. Automatic profiling requests execute normally so profiling remains useful. Streams and transaction reads bypass result caching.

| Control | Behavior |
| --- | --- |
| Omitted `cache`, default database options | Automatic qualification and second-use admission |
| `{ cache: 'auto' }` | Automatic qualification even in manual mode |
| `{ cache: false }` | Execute without result caching; one-shot methods also skip implicit plan reuse |
| `{ cache: true }` | Override scan/output-ratio heuristics; retain admission policy and byte limits |
| `{ cache: 'refresh' }` | Recompute, attempt immediate admission, do not coalesce |
| Open with `{ queryCache: { mode: 'manual' } }` | Use result caching on explicit request. Prepared plans can still be reused |
| Open with `{ queryCache: false }` | Disable both result and compiled-plan caches |

Prepared methods accept a second `cacheKey` boolean (default true). Set false to skip key preparation and plan reuse for plans that will never cache. A previously prepared plan remains usable after clearing the caches.

## Bounds and policy

```ts
const db = await openMemory({ queryCache: {
  mode: 'auto', minScannedRows: 128, maxOutputRatio: 0.25,
  policy: 'slru', admission: 'second-hit',
  maxEntries: 128, maxBytes: 16 * 1024 * 1024,
  maxEntryBytes: 2 * 1024 * 1024, maxKeyBytes: 16 * 1024,
  maxPlans: 64, maxPlanBytes: 1024 * 1024, maxPendingQueries: 16,
} });
```

These are the defaults. Storage is allocated on use. `policy: 'lru' | 'slru'`; `admission: 'always' | 'second-hit'`. SLRU uses probation and protected recency lists; hits promote entries, and the protected list is limited to 80% of entry count and byte budget. Eviction prefers probation. Second-use history is exact and bounded to twice `maxEntries` and one eighth of `maxBytes`. Automatically rejected results remove their history entry.

The 16 MiB result budget accounts for encoded values, UTF-16 keys, live-scope keys, estimated entry overhead and history. Each entry must also fit 2 MiB. Compiled plans have a **separate** 1 MiB/64-entry LRU budget: key bytes plus a 2 KiB per-plan estimate. Pending queries have a separate count bound of 16 distinct keys and reported key/overhead estimates. These are accounting limits, not total JS heap/RSS bounds. Query working memory, decoded return values, compiler allocations and caller-held prepared plans remain outside these budgets.

## Exactness and ownership

- Results are keyed by the pinned **collection version**, collection name, complete eligible descriptor, page, and resource/profiling options. Exact tagged text preserves primitive types, signed zero, property order and array order; Date/binary filter operands use binary DSON. Keys are not lossy hashes. Preserving property order matters for observable projection alias order.
- Even a hit opens a current read snapshot. Writes through other processes, workers or handles are observed. Explicit snapshots retain their old revision. A commit to a different collection can reuse the cached bytes. A committed document or schema mutation of the queried collection invalidates live reuse. Checks use a DBSONL record's actual commit revision.
- A live lookup observing a changed collection retires the previous result for that query scope. Snapshot queries can recompute evicted results from their pinned revision. A bounded map of at most `min(128, maxEntries)` collections remembers the last database head and collection version. An unchanged head saves a marker lookup. The result-byte estimate excludes this map.
- Plans are shared only across live collection handles in the same database. Snapshot and transaction closures are never retained in the plan cache. Public shared bound plans are frozen. Their execution opens a fresh snapshot each time.
- Descriptor keys are captured before asynchronous work; pages and execution options are copied before opening storage. A caller mutating the original descriptor cannot change an already prepared plan.
- Retained results are binary DSON. Every hit or coalesced follower independently decodes its result. Mutating one result cannot poison another; native types, cycles and within-result sharing survive encoding. The leader's original result is independent of retained bytes.
- Identity equality, opaque object operands, object-valued expression literals (including native Dates/buffers), functions, accessors, symbols, nonenumerable descriptor properties, custom prototypes, sparse arrays, cyclic descriptors and oversized keys bypass reusable keys. Object-valued literals must retain their own constant/alias semantics. These queries still execute.
- Custom `sizeOf`/`sizeOfOutput` callbacks bypass result caching and coalescing. They may still use a safely reusable compiled plan. Oversized or unserializable results are not retained. Automatic `profile: true` executes; explicit `cache: true` may return a cached summary.
- Transaction reads must observe staged writes and register conflict dependencies, so they receive no query cache. Streams never buffer a full output for result caching.

A hit reports the caller's pinned database revision in `summary.revision`. Scan and profile counts describe the computation that populated the entry. Use `queryCacheStats()` to observe caching.

## Concurrent misses and clearing

Live, signal-free concurrent requests with the same collection version, descriptor, page and budgets may share one execution. A follower is returned independent decoded bytes only when the leader's result qualifies and fits the cache. Otherwise followers execute independently; this avoids retaining unbounded intermediate results. Different budgets do not coalesce. Signal-bearing requests execute independently on misses, preserving cancellation behavior. Errors are propagated to waiting callers and the pending slot is always released.

`clearQueryCache()` clears results, history, version lookups and plans, and advances an epoch. Old pending executions remain tracked until settlement but cannot refill the cleared cache; new requests cannot join them. Existing waiters complete or recompute. Counters remain cumulative. Database close clears retained entries and normal lifetime checks reject use after close.

`versionReads` counts persisted collection-marker lookups. `crossRevisionHits` counts decodes whose returned revision was updated to the caller's head. Other stats expose hits, misses, admissions, rejections, evictions, invalidations, coalesced followers, plan hits/misses, entries/bytes, history entries/bytes, plans/plan bytes, and pending queries/bytes. `autoBypasses` counts post-compute heuristic rejections; early bypasses such as primary-key reads, profiling, unsupported keys and disabled caching do not create result lookups.

## Admission costs

Unconditional retention adds avoidable serialization and memory costs to point reads and full-output scans. Automatic qualification, second-use admission, bounded plans and exact miss sharing make repeated compact queries benefit without per-call configuration. Explicit controls remain for workloads the heuristic misclassifies. [Cold scans and cached results](PERFORMANCE.md) use the same historical count query.

SLRU plus bounded second-use history is not full LFU or TinyLFU. A Bloom filter before an exact in-memory Map lookup would add work without avoiding storage I/O. Storage-layer negative-read filtering remains a separate, unproven optimization requiring revision-consistent maintenance and its own benchmark.

Design references: [Caffeine design](https://github.com/ben-manes/caffeine/wiki/Design), [Caffeine eviction](https://github.com/ben-manes/caffeine/wiki/Eviction), [TinyLFU paper](https://arxiv.org/abs/1512.00727), [RocksDB Bloom filters](https://github.com/facebook/rocksdb/wiki/RocksDB-Bloom-Filter). This implementation does not embed those implementations.
