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

`at(date)` works for point and bulk reads, filters, sorts, projections, grouping, aggregates, totals, streams, prepared queries, ordered pages and all three search modes. Most callers can bind the collection once and reuse the existing API. Trailing read options accept `$historic` and `$asOfRevision`. Find descriptors also accept both fields.

- A historical point read seeks directly to the winning immutable assertion. It retrieves a second image only when a bounded correction left a restoration pointer. A previous recorded cutoff can require skipping newer facts.
- Collection scans emit at most one document per typed ID, including documents deleted from the live collection. Cold secondary indexes project the selected corpus and use the same physical ordering as live indexes. A historical continuation remembers its original effective date and recorded revision across later corrections, compaction and index removal.
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

Logical deletion, `compact()` and `collect()` preserve committed history. There is no automatic expiry or public pruning operation. Size capacity for full DSON images and index keys per change. The tracked-writer clock is shared across tracked collections. Concurrent tracked transactions can conflict even when their documents differ. [Measured performance](PERFORMANCE.md)
