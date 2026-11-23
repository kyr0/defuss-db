# Document history

A tracked collection answers two questions independently. The **effective date** selects the document that applied at an instant. The **recorded revision** selects which committed changes the reader can know about. A retroactive correction creates a new commit and preserves the earlier answer.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const prices = await db.ensureCollection<{id:string; eur:number}>('prices', { $trackHistory: true });
const jan = new Date('2026-01-01T00:00:00Z');
const feb = new Date('2026-02-01T00:00:00Z');
const jan20 = new Date('2026-01-20T00:00:00Z');

await prices.at(jan).put({ id: 'plan', eur: 20 });
await prices.at(feb).put({ id: 'plan', eur: 30 });
const before = (await db.stats()).revision;
await prices.update('plan', { eur: 25 }, { $historic: new Date('2026-01-15T00:00:00Z') });

await prices.get('plan');                              // { id: 'plan', eur: 30 }
await prices.get('plan', { $historic: jan20 });        // { id: 'plan', eur: 25 }
await prices.at(jan20, { $asOfRevision: before }).get('plan'); // { id: 'plan', eur: 20 }
await db.close();
```

## Collection lifecycle

`db.collection(name)` returns a handle immediately. `await db.ensureCollection(name, { $trackHistory: true })` persists the setting. Existing handles consult the schema on their next write. Tracking is opt-in per collection. Dollar-prefixed options are separate from document properties with the same names.

A newly created tracked collection can accept a backdated first record. Activating an existing collection seeds its current documents at one effective instant. Earlier dates raise `HISTORY_UNAVAILABLE`, including for IDs whose existence cannot be established. Enabling history again is idempotent. Passing `$trackHistory: false` to an already tracked collection rejects the change.

Activation first attempts one transaction. An existing collection that exceeds the transaction budget is seeded in batches. Pass `historyBatchSize` to request batching explicitly. Live reads continue during a staged baseline. Live writes and full-history exports for that collection report `HISTORY_ACTIVATING`. An aborted or interrupted build retains its continuation. Call the same `ensureCollection` again to resume. Every seed becomes visible at the same publication revision. The configured storage limits must admit a single seed and its metadata. Stop older writers, including browser tabs and existing processes, before activation. [Operating a store](OPERATIONS.md)

## Writes at an effective instant

| Operation | Effective behavior |
| --- | --- |
| Ordinary write | Uses the transaction's sampled time. All tracked writes in the transaction share that effective instant. |
| `at(t).put(doc)` | Writes a full image from `t` until the next boundary for that ID. An open-ended change also replaces the live document. |
| `insert`, `insertMany` | Require absence at the target date. An ID can be reinserted after deletion. |
| `update` | Runs the patch or callback against the visible document. A missing document returns false. |
| `delete` | Records a tombstone for the selected interval. A later version keeps its own effective date. |
| `{ $historic: t, $until: end }` | Ends the change at an exclusive upper bound. It must lie inside the selected slice or on its next boundary. At the end, the previous value or absence resumes. |
| `updateMany`, `deleteMany` | Select matching IDs from one historical transaction view and apply the changes atomically. |
| `db.transaction(fn, { $historic: t })` | Applies the date across collections in the transaction. Mutations and historical reads see earlier staged changes. Explicit transactions surface conflicts and invoke the callback once. |

An effective boundary remains meaningful even if adjacent values compare equal. A Date represents an exact UTC millisecond and is captured at call time. A finite Date in the future can project the known open segment. A future write or exclusive end raises `HISTORY_FUTURE_WRITE`. Invalid dates and reversed or empty ranges are rejected. An explicit recorded cutoff is read-only. Qualify a different database's receipt as described below.

A transaction orders assertions at the same effective millisecond by its recorded commit and within-transaction ordinal. Explicit snapshot readers also fix the maximum recorded cutoff. A requested cutoff beyond that snapshot raises `HISTORY_UNAVAILABLE`.

## Query and search

`at(date)` works for point and bulk reads, filters, sorts, projections, grouping, aggregates, totals, streams, prepared queries, ordered pages and all three search modes. Most callers can bind the collection once and reuse the existing API; `view.historic` is true for a bound view. Trailing read options accept `$historic` and `$asOfRevision`. Find descriptors also accept both fields.

- A historical point read seeks directly to the winning immutable assertion. It retrieves a second image only when a bounded correction left a restoration pointer. A previous recorded cutoff can require skipping newer facts.
- Collection scans emit at most one document per typed ID, including documents deleted from the live collection. Cold secondary indexes project the selected corpus and use the same physical ordering as live indexes. An index checks only the versions it was built on, so a past version may hold an object, array, Map, Set or oversized value in a field indexed later. An equality index still answers exactly when the value is an object, array, Map or Set, since such a value never equals an operand it can key. A key over the 4096-unit limit counts the document's ID, so a matching version could be missing; that index, and an ordered index, which would leave the version out of ranges and sorts, then leave queries at that time to another index or a scan. `pageByIndex`, `pageIdsByIndex` and `countByIndex` on such an ordered index raise `INVALID_INDEX_VALUE`. VERIFIED: tests/history.test.ts compares these answers with scans. A historical continuation remembers its original effective date and recorded revision across later corrections, compaction and index removal.
- Lexical, vector and hybrid search build the upstream engine over the visible corpus. ID eligibility, predicates, corpus statistics and document hydration all use the same slice. Index lookup uses the definition known at the selected recorded revision. Incompatible historical values or an oversized historical corpus raise the index's validation error.
- Values in an ordinary unique index can have multiple historical owners. To require uniqueness across overlapping effective intervals, declare `{ name: 'sku', fields: ['sku'], temporalUnique: true }` on a tracked collection. The build validates existing history. Related writes check potentially overlapping historical owners in the same serializable transaction. This adds scan work only when the stronger constraint is declared.
- Result cache keys include effective time, collection history generation or recorded cutoff, collection and query settings. An unrelated collection commit can reuse a historical result. Historical secondary postings have a separate byte-bounded LRU with up to eight entries. Set `queryCache.maxTemporalIndexBytes` to change its default 8 MiB retention budget, or zero to disable retention. `queryCacheStats()` reports entries and bytes. A cold named index still needs the working memory required to build it.

## Timeline and audit

`history(id)` returns effective segments newest start first with `from`, exclusive `until` (null for an open segment), `document`, `revision` and `ordinal`. A tombstone has an undefined document. `audit(id)` returns original assertions newest recorded change first. Each includes `kind`, its originally asserted interval and `recorded: {storeId, revision}`. Internally generated restoration boundaries appear in the effective listing. Both operations accept `{ limit, signal, $asOfRevision }`. The effective date of a bound collection does not trim the listed timeline.

## Deletion and restore

A deleted document's newest `history(id)` segment is an open tombstone: `document` is undefined, `until` is null, and `from` is the deletion's effective time as a Date. A backdated `at(t).delete(id)` records `t`. `audit(id)` lists the same change with `kind: 'delete'` and the revision that recorded it. Untracked collections keep no record of a delete.

`restore(id)` writes back the version the current delete removed, as a new version at the transaction's time, so the timeline keeps the deletion. It reads that version as the store knew it before the delete was recorded, which also finds a version inserted in the same millisecond as its delete. It returns false when the document is live or has no tombstone, and raises `HISTORY_NOT_ENABLED` on an untracked collection. A soft-delete field would instead leave deleted documents in every scan, index and query, and each query would have to exclude them. VERIFIED: tests/timestamps.test.ts.

## Backup, recovery and retention

```ts
const source = { storeId: db.storeId, revision: (await db.stats()).revision };
const backup = db.exportStream({ history: 'full' });
const fork = await openMemory();
await fork.import(backup);
const restored = await fork.collection('prices').at(jan20, { $asOfRevision: source }).get('plan');
```

A full Brotli archive includes immutable assertions, schema history, tombstones and original receipts. Restore it into an empty database. The fork receives its own identity and local commit counter. Bare numbers address this local counter. A source-qualified receipt reproduces a source belief, including after another export and restore. Further local edits advance the fork independently. A full restore validates current documents against the reconstructed open segments and rebuilds secondary projections before publishing.

Ordinary `export()` and `exportStream()` preserve latest data using the latest-only logical archive. Restoring a latest-only archive to an empty target creates ordinary collections. Use the full archive to carry history. `maxHistoryRecords` bounds full import/export independently of document and byte budgets. Import is a single atomic transaction and must fit the target's transaction limits.

Logical deletion, `compact()` and `collect()` preserve committed history, and nothing expires on its own; [pruning](#pruning) removes it on request. Size capacity for full DSON images and index keys per change. The tracked-writer clock is shared across tracked collections. Concurrent tracked transactions can conflict even when their documents differ. [Measured performance](PERFORMANCE.md)

## Pruning

Every tracked write stores a full DSON image of the document as an immutable assertion, with three rows that order it. Two operations remove recorded history. Neither changes a live document, its indexes or its search data.

```ts
const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
await prices.pruneHistory({ before: cutoff });          // versions that ended before the cutoff
await prices.pruneHistory({ ids: ['plan'] });            // every ended version of one document
await prices.pruneHistory({ from: jan, before: feb });  // a slice in between
await prices.pruneDeleted({ before: cutoff });          // documents deleted before the cutoff
```

| Operation | Removes | Keeps |
| --- | --- | --- |
| `pruneHistory({ before, from, ids })` | The versions that began at or after `from` and ended at or before `before`, with every assertion recorded for them. A version is one effective segment of an ID, a tombstone included. | The current state, the version in effect at `before` and every later one, a version that a later bounded correction resumes, and the version `restore(id)` writes back for a deleted document. |
| `pruneDeleted({ before, ids })` | Each document whose current state is a tombstone with an effective time before `before`: every version, the tombstone and its `audit` record. | Live documents and documents deleted at or after `before`. |

Every option is optional. Without `before`, `pruneHistory` removes every version that ended and `pruneDeleted` every deleted document. Without `ids` the whole collection is pruned. Both return `{ documents, versions }`: the documents that lost a version and the versions removed. Both raise `HISTORY_NOT_ENABLED` on an untracked collection and `HISTORY_READ_ONLY` on a collection bound with `at(date)`.

A removed range reads as absent. `get` at an instant in it answers undefined, and a scan at that instant leaves the document out. `history(id)` lists a removed slice that follows a kept version as a segment without a document. The version before the slice still ends where it ended: extending it over the slice would assert a document that did not apply then, and under a `temporalUnique` index it could overlap another owner. Raising `HISTORY_UNAVAILABLE` instead would fail every collection scan at an instant where one ID was pruned. Reads at or after `before` answer as before the prune. `audit(id)` and reads with `$asOfRevision` answer from the assertions that remain, so what the database knew about a removed version at an earlier revision cannot be reproduced.

`pruneHistory` keeps a deleted document restorable; `pruneDeleted` is the operation that removes it. `restore(id)` returns false afterwards. To erase a live document in one commit, delete it and prune it in one transaction:

```ts
await db.transaction(async (tx) => {
  const prices = tx.collection('prices');
  await prices.delete('plan');
  await prices.pruneDeleted({ ids: ['plan'] });
});
```

On a collection, a prune commits in batches of at most three quarters of `maxTransactionOperations`, so its size is not bound by one transaction; a version takes about four operations. Each commit leaves a store that `verify()` accepts. A call that stops midway, by `signal` or an error, has removed what its commits removed; repeat it for the rest.

A prune runs beside writers. It never makes a current write fail, and it conflicts only with a write to a document it is pruning, which it then reads again. Twelve batches in a row without a removal end the call with `CONFLICT`. Stop writers of builds up to 3.1.0 before you prune: this detection relies on a row that those builds leave untouched on a backdated write. VERIFIED: tests/history-prune.test.ts prunes 120 documents while each is updated. In a transaction a prune is atomic and raises `LIMIT_EXCEEDED` when it exceeds the transaction. A full-history archive of a pruned store holds the assertions that remain.

DBSONL commits never reuse file space, so the file shrinks with the next compaction, automatic or `compact()`. VERIFIED: (probe, 2026-11-23, memory store) 1,000 documents of about 1 KiB with 11 versions each held 46,009 stored entries in 30.0 MiB after compaction; after `pruneHistory()` and compaction they held 6,009 entries in 4.6 MiB, the entries of the 1,000 inserts. VERIFIED: tests/history-prune.test.ts.
