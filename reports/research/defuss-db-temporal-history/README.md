# Built-in history for defuss-db

**Research and proposed API · 2026-11-18 · baseline defuss-db 5.1.0**

Persist an effective-time history for each tracked document. Retain the commit at which each version or correction became known. Ordinary reads use the existing current document and indexes. A date selects an effective slice across the collection. A separate, optional revision makes the answer reproducible after someone corrects the past.

This package contains a design, probes of the released software, and an independent model of the proposed interval rules. The temporal API examples describe the proposal.

## What a historical edit means

Suppose a price was 100 from January 1 and changed to 120 on February 1. On March 1 an operator learns that the price was actually 110 starting January 15. All dates below are UTC in the same year.

| Effective instant read | Before the March correction | After the March correction |
| --- | ---: | ---: |
| January 10 | 100 | 100 |
| January 15, exactly | 100 | 110 |
| January 20 | 100 | 110 |
| February 1, exactly | 120 | 120 |
| March 1 after the correction | 120 | 120 |

**A date-targeted write starts at the supplied instant and stops at the next existing effective boundary for that ID.** With half-open intervals, the February version owns February 1. To change the entire selected version, supply its original start. Where the selected interval is still open today, correcting it also changes the current document. To describe a shorter exception, supply an earlier exclusive end. Future versions keep their independent full-document values. A correction to one field of an earlier document consequently has no implicit propagation through later versions.

At effective time V and recorded revision R, select the applicable assertion with the greatest pair of (commit revision, operation order) subject to its revision being at most R and its interval containing V. A winning tombstone means absent. Before known coverage the answer is unknown. These three outcomes need distinct API behavior. All records in one read use the same R. An older assertion remains available at its earlier recorded cutoff after a correction.

## Prior art and what carries over

| System | Evidence | Consequence for defuss-db |
| --- | --- | --- |
| XTDB | Effective time and system time are independent. Ordinary queries use current time, and both period types include their start and exclude their end. Its SQL API accepts explicit effective-time ranges for changes. [Concepts](https://docs.xtdb.com/concepts/key-concepts.html) · [Queries](https://docs.xtdb.com/reference/main/xtql/queries.html) · [Mutations](https://docs.xtdb.com/reference/main/sql/txs.html) | Give the caller one date for the common case. Expose the recorded cutoff when reproducing an earlier answer. Stopping a point correction at the next existing boundary is a defuss-db design choice. |
| MariaDB and IBM Db2 | A bounded business-time edit can split a row and preserve both unaffected portions. MariaDB also defines time-aware uniqueness through interval non-overlap. Db2 supports combining business and system cutoffs in one query. [MariaDB periods](https://mariadb.com/docs/server/reference/sql-structure/temporal-tables/application-time-periods) · [Db2 bitemporal queries](https://www.ibm.com/docs/en/db2/12.1.x?topic=bt-querying) | Make the interval end explicit in the contract. Distinguish uniqueness today from uniqueness across overlapping effective periods. |
| SQL Server | System versioning retains previous rows. Direct changes to the history table are prohibited while versioning is enabled. [Restrictions](https://learn.microsoft.com/en-us/sql/relational-databases/tables/temporal/considerations-limitations?view=sql-server-ver17) | Automatic before-images answer audit questions. Retroactive business corrections additionally need effective time. |
| Datomic | An as-of transaction identifier or database basis identifies a transaction more precisely than a wall-clock instant. [Database filters](https://docs.datomic.com/reference/filters.html) | Use the native commit revision for exact ordering. Two commits can affect the same effective millisecond. |
| MongoDB and CouchDB | MongoDB describes separate current and historical document sets and identifies infrequent updates as a good fit for that pattern. CouchDB compaction can remove old revision bodies. [MongoDB pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/document-versioning/) · [CouchDB compaction](https://docs.couchdb.org/en/stable/api/database/compact.html) | Keep the current path direct and measure the cost of storing full versions for frequently updated large documents. Give retained history its own logical keys that compaction preserves. |

## Public API

```ts
// Proposed TypeScript. The existing synchronous db.collection(name) remains a cheap handle.
const prices = await db.ensureCollection<Price>('prices', { $trackHistory: true });
const jan15 = new Date('2026-01-15T00:00:00.000Z');
const jan20 = new Date('2026-01-20T00:00:00.000Z');

await prices.get('plan');                          // Current effective value.
await prices.get('plan', { $historic: jan20 });    // Latest knowledge of January 20.
const before = (await db.stats()).revision;
await prices.update('plan', { amount: 110 }, { $historic: jan15 });
await prices.at(jan20).get('plan');                // Corrected historical value.
await prices.at(jan20, { $asOfRevision: before }).get('plan'); // Prior belief.
```

- **Activation.** Make the flag persistent collection metadata and activation awaitable, idempotent and atomic. Every writer checks the persisted schema. A handle acquired before activation must honor the flag on its next transaction. Keep both dollar-prefixed names available as ordinary document properties. The released library already round-trips them as data.
- **Reads.** A collection bound with `at(date)` supplies the same scope to `get`, `has`, `getMany`, find/query/stream, projections, aggregates, counts, views, prepared queries, ordered pages and search. Accept a trailing `$historic` in operation options as shorthand. Implement both forms through one resolver. Add `history(id)` with separate effective-segment and recorded-change views to expose boundaries and receipts.
- **Mutation.** A historical collection bound only to effective time can write against current knowledge. A view with an explicit recorded cutoff, or one obtained from a read-only snapshot, is read-only. A correction always commits in the present. Existing optimistic revision checks can protect an entire database. A per-document expected history revision would let an editor reject only relevant concurrent changes.
- **Date handling.** Capture a genuine finite Date as epoch milliseconds synchronously at API entry, including when a caller constructs a prepared historical view. Copy the instant so subsequent mutation of the Date cannot redirect the operation. Explicit targets preserve negative epochs, UTC millisecond boundaries and typed document IDs.
- **Scope.** An unqualified call uses the current materialized row. A historical operation on an untracked collection raises `HISTORY_NOT_ENABLED`. Database maintenance and schema changes operate against the current store. A snapshot fixes the maximum recorded revision for every collection, including historical queries. A requested newer recorded cutoff fails. A separately bound historical transaction sees its own staged changes at the selected effective time when reading current knowledge.
- **Cursor behavior.** An unpinned historical view with no recorded cutoff resolves latest knowledge at each new operation. The first page fixes its effective instant and recorded revision in its continuation, so later pages keep the first page's membership. Keep current v5.1 live-cursor staleness behavior. Reject mismatches in store, collection incarnation, index definition, scope or interval. A pruned historical basis reports an expiration error.

| Date-targeted operation | Proposed behavior |
| --- | --- |
| `insert` | Requires absence at the target instant. Creates the selected slice. A later known creation, deletion or reinsertion remains a boundary. |
| `put` | Replaces or inserts a full document from the target instant to the next boundary, or indefinitely when the interval is open. |
| `update` | Applies a patch or callback to the document visible at that instant. Missing document returns false. The callback runs once. The audit stores its result. |
| `delete` | Records absence for the selected slice. Missing document returns false. A later independently recorded version still becomes visible at its own start. |
| `updateMany`, `deleteMany` | Select IDs using the historical predicate in one transactional view, then apply the mutation to that slice for each ID. Validate predicate phantoms, resource budgets and all constraints before commit. |
| Optional `$until` | Exclusive upper bound inside the one selected slice. Reject reversed, empty or cross-boundary ranges. A future explicit multi-slice API can apply patches independently to each affected full document. |

Preserve user-declared effective boundaries even when adjacent values compare equal. Otherwise deduplication could lengthen the reach of the next date-targeted correction. Several changes to one document in one transaction may be visible while staging. A public recorded cutoff observes only the final committed outcome for each effective instant.

## Fit to the released code

The reference source is the complete [5.1.0 release](https://chatgpt.com/library?file_id=libfile_fde3_f-017e1f4c245c8191a24bd123426d7270_b85b428dab3481919779721c98fc6372&account_id=personal). Its ZIP SHA-256 is `3930feecc5ee50cc094d2c7d1c1937cd52f402222b1493fd0668c9e57ae89c96`. It pins DBSONL 0.6.0, Storage 0.3.1, DSON 1.5.1 and DataView 0.6.0. The reviewed [DBSONL store implementation](https://github.com/kyr0/defuss-dbjsonl/blob/1b1e7a7ce1a62112a219092d4cc519ea6c99da7e/src/core/store.ts) and [public scan types](https://github.com/kyr0/defuss-dbjsonl/blob/1b1e7a7ce1a62112a219092d4cc519ea6c99da7e/src/core/types.ts) are pinned to the revision identified by that release.

| Existing component | Temporal integration |
| --- | --- |
| `database.ts`, `types.ts`, `format.ts`, `keys.ts` | Snapshots hold a DBSONL generation pin until released. The current store marker is version 3. Add tracked schema, coverage metadata, immutable recorded cutoffs and an old-writer format fence. |
| `collection.ts`, `mutations.ts`, `search-mutations.ts` | Stage assertions, document-head updates, index changes and tombstones in the same existing DBSONL transaction. Callback patches can mutate nested native graphs. Capture or retain a whole immutable DSON image before handing mutable data to a callback when a before-image is needed. |
| `query.ts`, `source.ts`, `index-page.ts` | Introduce one time-aware row source and point-read resolver. Historical scans must enumerate IDs that have since been deleted. Apply visibility before filtering, sorting, grouping, projection or pagination. |
| `search.ts`, `collection-version.ts`, `query-cache.ts` | Current index contents and current corpus statistics can differ from a past slice. Separate current-document and history invalidation markers. Preserve snapshot ownership of all results. |
| `archive.ts`, `database.verify()` | Current archives carry logical schemas and visible documents. A restorable temporal archive needs assertions, tombstones, temporal schema, coverage metadata and recorded-order provenance. Extend integrity checks in both directions. |

### Physical design to prototype

1. **Keep the current row.** Preserve the live document key and v5.1 equality, ordered, lexical, vector and hybrid indexing paths. Add records only for tracked collections. With future scheduling deferred, the live row is the open effective version, or it is absent. A backdated correction touching that open interval must update the live row and all affected indexes in the same commit. A correction to a closed interval touches only temporal state.
2. **Store an immutable assertion per change.** Store the ID, valid-from, exclusive valid-to, operation order, and a full native DSON after-image or tombstone. A transaction nonce and ordinal can name the assertion before commit. Once committed, DBSONL's native row metadata supplies its actual recorded revision. Store payloads separately from small interval/index records when necessary to respect frame limits. Full images handle cycles, shared references, Maps and typed arrays. Retaining both the hot row and its historical body costs write bandwidth and storage. Measure that cost before introducing deltas or content deduplication.
3. **Materialize the latest interpretation of each ID's timeline.** One small ordered entry per effective boundary points to the immutable image and contains the exclusive end. The DBSONL API supports ascending `gte` / `lt` bounds and a row limit. A fixed-width, descending encoding of signed epoch milliseconds permits a predecessor seek using `limit: 1`. Include an unambiguous typed-ID delimiter in the key and preserve DBSONL's 4,096-code-unit limit. Convert each Date operand to BigInt before complementing or offsetting it across the whole Date domain. A new point correction splits only its selected interval. A finite explicit end can leave a third, right-hand segment pointing to the previous image.
4. **Reconstruct old knowledge from facts.** First support the correct bounded fallback over each ID's immutable assertions using actual recorded revisions and operation order. A current timeline lookup can use one predecessor pointer plus its image. Old-knowledge reads and collection-wide scans have different costs. Benchmark before adding per-ID revision checkpoints or a commit-stamped index. No design here assumes one B-tree seek solves both independent time dimensions.
5. **Assign time and order separately.** An implicit tracked write needs one effective millisecond across all touched collections in that transaction. A conservative first design samples UTC once, reads a persisted tracked-writer clock and takes the greater value. Updating the clock in the same transaction prevents a clock step backwards or a slower process from reordering implicit effective dates. Equal milliseconds are legal. Recorded order always comes from the actual commit revision. The sampled effective instant can precede physical publication. This simple clock can cause conflicts between disjoint tracked writers. Measure that before adopting it for high-contention workloads. A serialized, opt-in stamp assigned in DBSONL during publication is the alternative to prototype. FoundationDB provides a precedent for commit-stamped writes. [Versionstamps](https://apple.github.io/foundationdb/javadoc/com/apple/foundationdb/tuple/Versionstamp.html)
6. **Protect interval edits from concurrent splits.** Raw DBSONL transaction range scans currently take a conservative whole-store phantom dependency. Use them to establish a correctness baseline. For point edits, compare a per-ID timeline guard and schema version in the committing transaction against the same pinned preflight snapshot used to discover the interval. Every edit, including a purely past edit, changes that guard. Keep guard identity across deletion/reinsertion to detect intervening changes. Respect an explicit transaction's own overlay. Multi-ID predicate updates also need a collection-level phantom guard or the conservative transactional scan. Surface conflicts without rerunning an application callback. On an uncertain commit, use the same mutation identity to resolve whether it was recorded.

No continuously advancing index is required for historical corrections. Initially accept past and present writes, and explicit finite ends through the captured present. Reject future write boundaries with a distinct error. A future effective read can return what the current known open interval projects to that instant. Supporting scheduled changes later requires transition-aware live reads, uniqueness and cache invalidation across tabs, processes, sleep and reopen. A wall timer alone cannot provide those semantics.

### Indexes, queries and search

- **Current reads.** Target the existing primary, ordered and cached accesses without a history scan. A current read on an untracked collection should perform zero additional storage gets. Track the effective-history generation separately so a closed-interval edit can invalidate an unpinned historical answer without evicting a valid current result.
- **Historical relational reads.** First execute the existing DataView plan over exactly one version per visible ID in deterministic typed-key order. Include deleted-today IDs and exclude not-yet-created IDs at V. Preserve v5.1 tie, nullish, native-date and binary behavior. For named ordered APIs, emulate the declared tuple's physical sort buckets and primary-key tiebreaker even when using a fallback. Their index-only performance contract applies only when a matching temporal index actually supplies the answer. Report the chosen access path, scanned versions and output budgets in `explain`.
- **Search.** A global top-k from today's lexical/vector/hybrid engine followed by historical filtering can miss the true candidates. Even surviving lexical documents may have a different BM25 score because the historical corpus has different frequencies and lengths. Start with the existing upstream engines built from the time-visible corpus using the applicable index definition. Apply eligibility before top-k and hydrate from the same slice. Cache complete immutable engines only within bounded resources. Compare historical results with a freshly built reference engine for that slice, with identical configuration, insertion order and tie rules.
- **Schema and constraints.** Use index definitions known at the selected recorded revision. An undefined index gives a schema error. Validate old values before promising a historical ordered/vector index over them. An incompatible historic value must produce an explicit result according to the index contract. Keep existing `unique: true` semantics on the live view. Offer an explicit temporal-unique constraint for applications that need the same key to have one owner throughout overlapping effective periods. It requires interval-overlap checks and transactional conflict protection across IDs. With live-only uniqueness, a historical equality query must allow multiple historical owners.
- **Caching.** Bind effective instant, resolved record basis or relevant history generation, schema/index identity, descriptor, paging and budgets to historical results. Stream once against one pinned basis. Budget or bypass high-cardinality timestamp caches. On explicit historical operations that exceed a budget, return a distinguishable failure. Returning today's data would silently corrupt the answer.

### Activation, retention and backup

| Condition | Recommended policy |
| --- | --- |
| New, empty tracked collection | Start with an empty timeline. A new assertion can have an earlier effective date. Recorded cutoffs before the collection existed still see no collection. |
| Turning tracking on for existing data | Seed all current documents at one activation boundary. Mark earlier time unavailable, unless a separately verified import establishes earlier coverage. The absence of an old version cannot establish that a document did not exist. |
| Store compatibility | A v5.1 writer would bypass history. Fence the store format on opt-in and quiesce already-open legacy writers before activation. Changing a marker alone cannot evict a handle that checked it only on open. |
| Large activation | Publish the new feature only after a complete baseline exists. Start with one bounded atomic activation. For data beyond transaction limits, use a resumable, staged baseline under a write fence or a verified catch-up log, then atomically publish the manifest. |
| Deletion, retention and pruning | Keep tombstones and old assertions by default. Logical deletion, physical compaction and intentional pruning have separate meanings. A retention policy must preserve the state entering the earliest retained interval, coverage watermarks and pinned readers. Out-of-coverage reads fail explicitly. |
| Portable archives | Preserve the existing latest-data export. Add an explicit full-history backup mode and label archive coverage. A full restore retains source store/revision provenance, timeline ordering and deletion markers, then rebuilds derived indexes. Imported DBSONL rows get new local revisions, so persist the original recorded stamps separately and translate source-qualified receipts. An empty-target restore should precede any support for merging divergent histories. |

## Experiments and release gates

Two independent checks are included. The first used the actual v5.1.0 npm tarball from the release ZIP with its pinned packages. The second tests the proposed semantics without a storage engine.

| Experiment | Observed result |
| --- | --- |
| Pinned snapshot on a native directory | The pinned reader returned 10 after update and compaction while live reads returned 30. After close and reopen, the live read returned 30. An ordinary logical archive restored one document at 30. |
| Disjoint commits using DBSONL 0.6.0 | A callback read revision 1. A different key committed at 2. The first callback's actual receipt and stored row revision were both 3. Compaction preserved that live key's recorded revision. |
| Historical lexical search | In a pinned snapshot, the query for "amber" returned two IDs. After deleting one match and adding six nonmatching documents, only one match remained. Its unchanged document scored 0.2292 in the old corpus and 1.6740 in the new one. |
| Range-scan contention | A transaction scanned a single key in a bounded interval. An unrelated write outside that interval caused the scanning writer to reject at commit with `CONFLICT`. |
| Date-key predecessor | An ascending DBSONL scan over descending date keys returned the expected predecessor at 18 instants over eight boundaries, including both extreme JavaScript Date values. |
| Interval semantics | Across 2,304 seeded transaction attempts, dense labeled time cells agreed with the boundary model in 141,456 staged cell comparisons. Replaying committed interval assertions matched every retained cutoff in 51,024 further comparisons. Cases included equal values, point and bounded edits, tombstones, missing IDs, rollback and multiple writes in one transaction. |

The probe ran on Linux x64 with Node 26.13.1. The interval model uses scalar payloads, 16 discrete instants and three document IDs. These experiments establish specific storage behavior and test the interval rules. Temporal throughput, browser behavior and production crash recovery need measurement on the eventual implementation.

**First prototype.** Implement tracked point mutations, the latest head, interval resolver, exact recorded cutoffs and archive/reopen on a disposable branch. Compare generated operation traces against the independent oracle. Add the complete time-aware query source and search parity before advertising collection-wide temporal support.

**Acceptance measurements.** Compare exactly the same v5.1 and candidate operations on untracked collections, then current and historical operations on tracked collections. Vary versions per ID, backdate distance, document bytes, ID cardinality, tombstones, native graph structure, readers and writers. Record physical gets, scanned entries, bytes written, storage after compaction, conflicts, latency distributions and peak memory. Run Node and Bun directories as well as real Chromium OPFS workers. Include clock rollback, same-millisecond commits, source/target revision collisions, failure at publication, stream cancellation, rollback, stale cursors, snapshot release, interval-overlap uniqueness and a full-history restore. Distinguish the first historical search build from warm reuse.

### Reproduction

The [released v5.1.0 ZIP](https://chatgpt.com/library?file_id=libfile_fde3_f-017e1f4c245c8191a24bd123426d7270_b85b428dab3481919779721c98fc6372&account_id=personal) includes its dependency lockfile and compiled package. In the extracted v5.1.0 project, install its pinned dependencies with `bun install --frozen-lockfile`, copy this package's `baseline-probe.mjs` into the project root, then run `node baseline-probe.mjs`. The probe also runs in a clean consumer that installs the release tarball alongside `defuss-dbsonl@0.6.0`. It creates and removes its own test directory.

Run `python3 interval-oracle.py` from this research package to reproduce `oracle-results.json` using the Python standard library. The captured probe output is in `baseline-results.json`.
