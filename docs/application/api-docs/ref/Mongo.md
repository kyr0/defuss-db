# Mongo

defuss-db/mongo: MongoDB filter, sort, projection and pipeline documents on any collection - a Collection, a view from at(date) or a TransactionCollection.

| Member | Signature | Description |
| --- | --- | --- |
| [findMongo](Mongo/findMongo.md) | `findMongo<T = Doc>(collection: MongoReadable, filter?: MongoDocument, options?: MongoFindOptions): Promise<T[]>` | Projected documents. Each document argument is an object or its text. |
| [aggregateMongo](Mongo/aggregateMongo.md) | `aggregateMongo<T = Doc>(collection: MongoAggregatable, pipeline: readonly Doc[] \| string): Promise<T[]>` | MongoDB's result documents: { _id, ...accumulators }, or [{ [name]: n }] for $count (none when nothing matched). |
| [mongoRequest](Mongo/mongoRequest.md) | `mongoRequest(q: unknown, filter?: MongoDocument, sort?: MongoDocument, options?: TranslateOptions): MongoRequest` | { filters, where?, sorters? } for find, query, count or explain. scalarFields names the top-level fields an index covers; scalarOptions(collection) reads them. |
| [translatePipeline](Mongo/translatePipeline.md) | `translatePipeline(stages: readonly Doc[]): PipelinePlan` | The plan of a pipeline (match, keys, measures, sort, limit) / its aggregate descriptor. |
| [aggregateDescriptor](Mongo/aggregateDescriptor.md) | `aggregateDescriptor(plan: PipelinePlan, q: unknown, options?: TranslateOptions): Doc` | The plan of a pipeline (match, keys, measures, sort, limit) / its aggregate descriptor. |
| [parseDocument](Mongo/parseDocument.md) | `parseDocument(text: string, what?: string): Doc` | Shell or Extended JSON text as values: ISODate() and { $date } become a Date, NumberLong() and { $numberLong } a BigInt. |
| [parsePipeline](Mongo/parsePipeline.md) | `parsePipeline(text: string): Doc[]` | Shell or Extended JSON text as values: ISODate() and { $date } become a Date, NumberLong() and { $numberLong } a BigInt. |
| [stringify](Mongo/stringify.md) | `stringify(value: unknown, space?: number \| string): string` | Values as Extended JSON text and back. |
| [revive](Mongo/revive.md) | `revive(value: unknown): unknown` | Values as Extended JSON text and back. |
| [translateFilter](Mongo/translateFilter.md) | `translateFilter(doc: Doc, q: Builders, options?: TranslateOptions): Translated` | The parts of findMongo. |
| [translateSort](Mongo/translateSort.md) | `translateSort(doc: Doc): MongoSorter[]` | The parts of findMongo. |
| [project](Mongo/project.md) | `project(doc: Doc, projection: Doc): Doc` | The parts of findMongo. |

Interactive: [Mongo in the app](../../app-api-docs.html#/ref/Mongo).
