# Ordered indexes and keyset pagination

An ordered index stores one key per document in the underlying DBSONL B+tree. Use one when the application repeatedly sorts a collection, scans an interval, or continues an ordered feed. The package builds and maintains indexes on explicit declaration.

```ts
await events.createIndex({
  name: 'feed',
  fields: ['tenant', 'info.time'],
  order: ['asc', 'desc'],
});
const selection = {
  filters: [
    { field: 'tenant', op: 'eq' as const, value: 'eu' },
    { field: 'info.time', op: 'gte' as const, value: new Date('2026-01-01') },
  ],
  sorters: [{ field: 'info.time', direction: 'desc' as const }],
  limit: 20,
};
console.log((await events.explain(selection)).access);
const { rows, summary } = await events.query(selection);
```

## Index keys and ties

Declare one direction per distinct field, up to 16 fields. Omitting `order` creates the existing equality index. Use a separate `unique: true` equality index when uniqueness is required. Each collection can have 64 equality and ordered indexes combined.

The codec implements DataView's default total sort order for representable cells. In ascending order the ranks are booleans, numbers, bigints, strings, valid dates, binary, invalid numbers/dates, then nullish values. Strings use UTF-16 code units, dates use timestamps, and buffers/views use their visible bytes. Negative and positive zero tie. NaN and invalid dates tie. Null, undefined and a missing field tie. Declared ordered fields accept those values. An array, Map, Set, or other opaque object in an indexed field rejects the build or write atomically. Documents can contain DSON graphs in other fields.

Every tuple ends in its natural typed storage ID in ascending order. This makes tied rows deterministic across page boundaries, even when two IDs share a prefix. Natural ID order sorts their storage tokens lexicographically. Numeric identifiers need not increase numerically. The complete encoded key, including namespace, tuple and ID, must fit 4,096 code units. Long UTF-16 strings and binary values expand in the order-preserving representation.

## Query planning

- An ANDed equality prefix fixes consecutive leading fields. Bounds on the next field are intersected into one half-open storage interval. The executor still evaluates the complete original DataView predicate, including `where` and any residual filters. A predicate expressed only in `where` supplies no bounds to the planner.
- When a simple field sort matches the entire varying suffix in the declared directions, the planner supplies DataView's ordering certificate. Filters on any remaining fields still run. Eligible page queries can stop after finding the page and its lookahead. A request for an exact total can require reading the rest of the interval. A sort on only part of a varying suffix cannot certify tie order.
- For a range lacking the requested order, the planner probes up to 129 pointers. At most 128 candidates are sorted by typed primary key before document reads. A larger interval falls back to the ordinary equality index or collection scan. This preserves natural ties, first-seen groups and floating-point reduction order. Aggregate and view totals keep that encounter order.
- A complete equality tuple can use its equality index. Primary-key equality and a short primary-key IN list use direct document reads. IN accepts up to 256 input members on this path, deduplicates typed IDs, and restores natural order before applying the full query. Larger lists remain valid DataView queries.
- Locale collation, identity comparison and computed sorts do not acquire an ordered-index certificate. Unsuitable order declarations leave sorting to DataView. `access: 'scan'` forces the collection reference path. `explain().access` reports the chosen physical plan. Its `primary-in` and `range` variants also report `pointKeys`.

Ordinary filters retain DataView's comparison and invalid-value rules. `pageByIndex` is lower level and addresses the **sort-key buckets** directly. For example, `prefix: [null]` includes missing and undefined values in that leading field. To distinguish them, use a regular filtered query.

## Cursor contract

```ts
const snapshot = await db.snapshot();
try {
  const feed = snapshot.collection('events');
  const range = { prefix: ['eu'], gte: new Date('2026-01-01'), limit: 100 };
  let after: string | undefined;
  do {
    const page = await feed.pageByIndex('feed', { ...range, after });
    for (const row of page.rows) console.log(row.id);
    after = page.nextCursor ?? undefined;
  } while (after);
} finally {
  await snapshot.close();
}
```

`prefix` fixes leading components. Supply at most one of `gt/gte` and one of `lt/lte` for the following component. Bounds use the natural comparison direction, also on descending indexes. A full-width prefix selects the tie bucket and accepts no additional bounds. An empty interval returns an empty page. The default limit is 50, with a maximum of 1,000. `maxOutputBytes` caps estimated returned row bytes at 16 MiB by default. `signal` supports cancellation. An exceeded byte budget rejects the page. A page reads at most its limit in documents and examines at most one additional index pointer. Storage pages and documents have independent physical I/O costs.

Pass `nextCursor` back as `after` with the same index and interval. The limit can change. A null cursor means the interval is exhausted. The token carries the previous full physical key, so a continuation seeks to the next row. Reaching an arbitrary page position for the first time requires a known key, an earlier cursor, or traversal.

| Context | Continuation behavior |
| --- | --- |
| Live collection | Same store UUID and collection version required. Unrelated commits can advance the returned database revision. A committed write or DDL to this collection makes the old cursor stale. |
| Explicit snapshot | Pages observe its pinned state across writes, index drops and compaction. Close the snapshot after the sequence to release its storage generation. |
| Reopened directory or OPFS store | An unchanged physical store identity, collection version, index and range permit resumption. A logical import into another database has that target's UUID. |
| Transaction | The cursor belongs to its transaction. A subsequent admitted write operation on that transaction advances its private sequence, including an operation on another collection. |

A malformed or out-of-scope token raises `INVALID_CURSOR`. A changed collection version or transaction write sequence raises `STALE_CURSOR`. Start a fresh live traversal in that case or retain the originating snapshot when every page must see the same data. The opaque token encodes the range and position with base64url. Applications exposing it to untrusted clients must enforce their own authorization and, if required, authenticate token contents.

Seek pagination and leftmost equality/range planning follow established B-tree techniques. The tuple codec, DataView ordering proof and DBSONL consistency contract are implemented in this package. [SQLite row-value scrolling](https://www.sqlite.org/rowvalue.html#scrolling_window_queries) · [SQLite multi-column indexes](https://www.sqlite.org/queryplanner.html#multi_column_indices)

## ID pages and counts

```ts
const view = snapshot.collection<Event>('events');
const range = { prefix: ['eu'], gte: new Date('2026-01-01') };
const ids = await view.pageIdsByIndex('feed', { ...range, limit: 64 });
const n = await view.countByIndex('feed', { ...range, maxScannedEntries: 100_000 });
```

Each ordered leaf already stores the typed primary ID. An ID page reads at most `limit + 1` pointers, converts each returned token to its original string, finite number or bigint, and returns `IndexPage<Event['id']>`. Numeric zero has one canonical identity. Byte limits apply to the returned IDs. The document and ID methods accept the same continuation for the same store, collection, index, interval and visible collection version.

An exact count visits each pointer in the interval, in bounded batches. Its cost grows with the number of matched entries. The optional nonnegative `maxScannedEntries` causes a `RangeError` once the count exceeds the budget. A zero budget succeeds on an empty interval. Both live index-only operations check pointer placement and issue zero primary-document reads. A cold historical index first reads the visible corpus to build its time-specific postings. Native I/O still reads storage windows. Use `verify()` to check the index against every document.

A physical interval groups missing, undefined and null into one sort bucket. Use a DataView predicate when the requested semantics distinguish them. Pin one snapshot for a page and count that must observe the same commit. Inside transactions, the methods include staged changes.
