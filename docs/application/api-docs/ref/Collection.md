# Collection

A collection of documents. db.collection(name) returns one without I/O; each write commits in its own transaction, and the reads are the same on snapshots and in transactions.

| Member | Signature | Description |
| --- | --- | --- |
| [insert](Collection/insert.md) | `insert(value: NewDocument<T>, options?: WriteOptions): Promise<PrimaryKey>` | Reject existing ID; return ID; omitted ID generates UUID |
| [insertMany](Collection/insertMany.md) | `insertMany(values: readonly NewDocument<T>[], options?: WriteOptions): Promise<PrimaryKey[]>` | One atomic bounded batch; return IDs |
| [insertBatches](Collection/insertBatches.md) | `insertBatches(batches: AsyncIterable<readonly NewDocument<T>[]> \| Iterable<readonly NewDocument<T>[]>, options?: WriteOptions): AsyncGenerator<{` | Async generator of { ids, revision, storedEntries }; one atomic commit per input batch |
| [put](Collection/put.md) | `put(value: Replacement<T>, options?: WriteOptions): Promise<PrimaryKey>` | Insert or replace whole document with required ID; return ID |
| [update](Collection/update.md) | `update(id: PrimaryKey, updater: Updater<T>, options?: WriteOptions): Promise<boolean>` | Shallow own-property patch or complete replacement callback; return whether ID existed |
| [delete](Collection/delete.md) | `delete(id: PrimaryKey, options?: WriteOptions): Promise<boolean>` | Return whether ID existed |
| [restore](Collection/restore.md) | `restore(id: PrimaryKey, options?: Omit<WriteOptions, '$historic' \| '$until' \| '$asOfRevision'>): Promise<boolean>` | Tracked collections: write back the version a delete removed as a new version; return false if the document is live or was never deleted |
| [updateMany](Collection/updateMany.md) | `updateMany(request: FindRequest, updater: Updater<T>, options?: WriteOptions & QueryOptions<T>): Promise<number>` | Atomic bounded set update; return affected document count |
| [deleteMany](Collection/deleteMany.md) | `deleteMany(request?: FindRequest, options?: WriteOptions & QueryOptions<T>): Promise<number>` | Atomic bounded set deletion; return affected document count |
| [createIndex](Collection/createIndex.md) | `createIndex(index: IndexDefinition, options?: WriteOptions): Promise<void>` | Atomic equality or ordered build. Set order to one direction per field. An identical declaration is idempotent; mismatched existing name rejects |
| [createSearchIndex](Collection/createSearchIndex.md) | `createSearchIndex(index: SearchIndexDefinition, options?: WriteOptions): Promise<void>` | Atomic lexical/vector/hybrid build; see Search |
| [dropSearchIndex](Collection/dropSearchIndex.md) | `dropSearchIndex(indexName: string, options?: WriteOptions): Promise<boolean>` | Atomic removal of search inputs, state and definition |
| [dropIndex](Collection/dropIndex.md) | `dropIndex(indexName: string, options?: WriteOptions): Promise<boolean>` | Atomic removal; return whether it existed |
| [get](Collection/get.md) | `get(id: PrimaryKey, options?: HistoryReadOptions): Promise<T \| undefined>` | Document or undefined |
| [at](Collection/at.md) | `at(date: Date, options?: {` | The collection at an effective date: reads see the documents of that instant, and on a live collection that tracks history, writes take effect then. { $asOfRevision } reads only what that revision recorded. See Document history |
| [history](Collection/history.md) | `history(id: PrimaryKey, options?: HistoryListOptions): Promise<HistorySegment<T>[]>` | Effective segments, newest start first: from, exclusive until (null while open), document (undefined for a delete), revision, ordinal |
| [audit](Collection/audit.md) | `audit(id: PrimaryKey, options?: HistoryListOptions): Promise<HistoryChange<T>[]>` | Recorded changes, newest first: kind, the asserted interval and recorded: { storeId, revision } |
| [getMany](Collection/getMany.md) | `getMany(ids: readonly PrimaryKey[], options?: {` | Ordered documents/undefined; duplicate IDs preserved; one snapshot; at most 100,000 IDs |
| [searchIndexes](Collection/searchIndexes.md) | `searchIndexes(options?: HistoryReadOptions): Promise<SearchIndexDefinition[]>` | Persisted search definitions |
| [search](Collection/search.md) | `search(index: string, query: DocumentSearchQuery, options?: SearchRequest): Promise<DocumentSearchResult<T>>` | Revision-bound scored hits; see Search |
| [has](Collection/has.md) | `has(id: PrimaryKey, options?: HistoryReadOptions): Promise<boolean>` | Boolean |
| [find](Collection/find.md) | `find(request?: FindRequest, input?: QueryOptions<T>): Promise<T[]>` | Document array |
| [findOne](Collection/findOne.md) | `findOne(request?: FindRequest, input?: QueryOptions<T>): Promise<T \| undefined>` | First matching document or undefined; effective limit is one |
| [query](Collection/query.md) | `query(request?: FindRequest, input?: QueryOptions<T>): Promise<ComputeResult<T>>` | { rows, summary } |
| [pageIdsByIndex](Collection/pageIdsByIndex.md) | `pageIdsByIndex(index: string, options?: IndexPageOptions): Promise<IndexPage<T['id']>>` | Keyset page of typed primary IDs. Returns { rows, nextCursor, revision }. Accepts document-page cursors for the same scope and range. |
| [countByIndex](Collection/countByIndex.md) | `countByIndex(index: string, options?: IndexCountOptions): Promise<number>` | Exact number of ordered index entries matching prefix and bounds. Optional maxScannedEntries rejects excessive work. Accepts an abort signal. |
| [pageByIndex](Collection/pageByIndex.md) | `pageByIndex(index: string, options?: IndexPageOptions): Promise<IndexPage<T>>` | Seek page of documents with rows, nextCursor and snapshot revision. Cursor contract |
| [stream](Collection/stream.md) | `stream(request?: FindRequest, input?: QueryOptions<T>): AsyncGenerator<ComputeEvent<T>>` | DataView batch / complete events |
| [count](Collection/count.md) | `count(selection?: Selection, input?: QueryOptions<T>): Promise<number>` | Exact count of matching documents |
| [select](Collection/select.md) | `select<const D extends RowsDescriptor>(descriptor: D, page?: Page, input?: QueryOptions<T>): Promise<ComputeResult<RowsOutput<D>>>` | Typed projected rows and summary |
| [aggregate](Collection/aggregate.md) | `aggregate<const D extends AggregateDescriptor>(descriptor: D, page?: Page, input?: QueryOptions<T>): Promise<ComputeResult<AggregateOutput<D>>>` | Typed grouped/scalar rows and summary |
| [view](Collection/view.md) | `view<const D extends ViewDescriptor>(descriptor: D, page?: Page, input?: QueryOptions<T>): Promise<ViewResult<RowsOutput<D>, TotalsOutput<D>>>` | Typed projected rows, totals and summary |
| [prepareFind](Collection/prepareFind.md) | `prepareFind(request?: FindRequest, cacheKey?: boolean): BoundQuery<T, T>` | Bound prepared plan: evaluate, stream, explain |
| [prepareSelect](Collection/prepareSelect.md) | `prepareSelect<const D extends RowsDescriptor>(descriptor: D, cacheKey?: boolean): BoundQuery<T, RowsOutput<D>>` | Bound prepared plan: evaluate, stream, explain |
| [prepareAggregate](Collection/prepareAggregate.md) | `prepareAggregate<const D extends AggregateDescriptor>(descriptor: D, cacheKey?: boolean): BoundQuery<T, AggregateOutput<D>>` | Bound prepared plan: evaluate, stream, explain |
| [prepareView](Collection/prepareView.md) | `prepareView<const D extends ViewDescriptor>(descriptor: D, cacheKey?: boolean): BoundQuery<T, RowsOutput<D>, TotalsOutput<D>>` | Bound prepared plan: evaluate, stream, explain |
| [explain](Collection/explain.md) | `explain(request?: FindRequest): Promise<{` | { revision, access, query }; access selection for the inspected snapshot |
| [source](Collection/source.md) | `source(options?: HistoryReadOptions): RecordSource<T>` | Document-level DataView RecordSource<T> |
| [indexes](Collection/indexes.md) | `indexes(options?: HistoryReadOptions): Promise<IndexDefinition[]>` | Fresh persisted equality and ordered definitions |
| [q](Collection/q.md) | `q: defuss_dataview_compute.ComputeFor<T>` | DataView forRows<T>() builders and plan factories |

Interactive: [Collection in the app](../../app-api-docs.html#/ref/Collection).
