# Collection reads

The members are in the reference: [Collection](../../app-api-docs.html#/ref/Collection).

`FindRequest`: `filters`, `where`, `semantics`, `sorters`, `offset`, `limit`, `numberMode`, `invalidNumbers`, `access: 'auto' | 'scan'`. Filters support `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `startsWith`, `endsWith`. Filters are ANDed. `where` uses `q.and`, `q.or`, `q.not`, comparisons, arithmetic and nullish tests. Query fields use DataView's safe own-property rules, not prototype traversal. A `prepareFind` plan captures its default page; passing a page to `evaluate` replaces that default page.

Projection descriptors contain `select: { alias: Expr }`, optional `filters/where`, and `orderBy: [{ expr, direction }]`. Aggregate descriptors contain optional `groupBy`, required `measures`, optional `having` over result aliases, and output-alias `orderBy`. View descriptors contain `select`, `totals` and row-expression ordering. These are DataView descriptors, not a separate SQL dialect.

Expressions include calendar buckets (`dateTrunc`, `datePart`, in UTC or an IANA time zone), text (`lower`, `upper`, `trim`, `substring`, `concat`, `length`), `cond` and rounding (`floor`, `ceil`, `round`, `abs`). The group key `each(expr)` unwinds arrays: a document joins one group per distinct element and none for an empty array. Measures are `count`, `sum`, `avg`, `min`, `max`, `sumBigInt`, `countDistinct`, `distinct`, `percentile` and `median`; each takes an optional `where`. Query workers answer a full-scan aggregate when every measure merges: all of them do except `sum` and `avg` outside `numberMode: 'exact'`. DataView's COMPUTE_SEMANTICS.md defines each result, including time zone transitions and percentile interpolation.

There is no join. To combine collections, read them in one `db.snapshot()`: aggregate one collection, then fetch the documents its group keys name with `getMany` on the other. VERIFIED: both reads see the same revision, and the second reads only the documents the groups name (tests/database.test.ts 'aggregates one collection and reads another by its group keys in one snapshot').

```ts
const snapshot = await db.snapshot();
try {
  const orders = snapshot.collection<Order>('orders'), q = orders.q;
  const totals = await orders.aggregate({
    groupBy: { customer: q.field('customer') }, // a customer ID
    measures: { revenue: q.sum(q.field('amount')) },
    orderBy: [{ field: 'revenue', direction: 'desc' }],
  }, { limit: 10 });
  const customers = await snapshot.collection<Customer>('customers')
    .getMany(totals.rows.map((row) => row.customer)); // in the order of totals.rows
} finally {
  await snapshot.close();
}
```

`ComputeOptions`: `count`, `batchSize`, `maxBatchBytes`, `maxRowBytes`, `maxScannedRows`, `maxWorkingBytes`, `maxGroups`, `maxOutputRows`, `maxOutputBytes`, `yieldEveryBatches`, `profile`, `sizeOf`, `sizeOfOutput`, `signal`. Custom `sizeOf` sees public documents. Custom `sizeOfOutput` sees actual public output rows, including whole documents for `find/query/stream`. Estimators must be pure and stable; they account memory and do not serialize values.

Default grouping/working-state capacity is 64 MiB and 100,000 groups; collected output is limited to 100,000 rows and 64 MiB. Use streaming for larger row output and explicit budgets for large sorts/groups. Streaming does not make an unbounded sort or grouping bounded without a cap.

Summary fields are DataView's `ComputeSummary`. `revision` identifies the snapshot; `scannedRows` counts candidate documents seen by the query executor. `sourceRows` describes the candidate source, not necessarily the entire collection. `totalInputMatches` and `totalResultRows` may be `null` if execution legitimately stops early; `count: 'exact'` requires exact result totals. `hasMore`, `sourceExhausted`, strategy and peak accounting remain explicit. A failed/cancelled stream does not emit a successful complete event; earlier batches may already have been consumed.

Default ordering without `sorters/orderBy` follows typed storage keys. It is not insertion order or numeric ID order. Specify a deterministic tie-breaker such as `id` when pagination needs an explicit order. Use `pageByIndex` for keyset traversal in declared index order, including the storage-ID tie-breaker.

`explain().access.kind` can be `scan`, `primary`, `primary-in`, `equality`, `range` or `ordered`. Ordered/range plans expose the index name, length of the fixed equality prefix, and range field when present. `primary-in` and bounded `range` plans report their point-key count. Explaining a bounded range may probe index pointers.

Interactive: [Collection reads in the app](../../app-api-docs.html#/guides/collection-reads).
