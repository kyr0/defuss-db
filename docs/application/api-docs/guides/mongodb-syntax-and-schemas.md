# MongoDB syntax and schemas

`defuss-db/mongo` is a separate entry, so an application that never reads MongoDB syntax never loads it. Every function takes any collection: a `Collection`, a `ReadCollection` bound with `at(date)` or a `TransactionCollection`.

The members are in the reference: [Mongo](../../app-api-docs.html#/ref/Mongo).

Filters: `$eq $ne $gt $gte $lt $lte $in $nin $exists $type $size $all $elemMatch $mod $regex $not`, `$bitsAllSet $bitsAnySet $bitsAllClear $bitsAnyClear` and `$and $or $nor`, on top-level fields and dot paths. `$regex` takes `^prefix`, `suffix$`, `^exact$` or plain text, with metacharacters escaped by `\`, and the option `i`. Other patterns, other options, `$expr`, `$where`, `$text` and equality with an embedded document throw a `QueryError`; compare a subdocument's fields with dot paths instead. A projection includes or excludes fields (dot paths too); the id stays unless `{ id: 0 }`.

Matching follows MongoDB's rules:

- `null` matches a null or missing field, and `$exists` tells them apart.
- A comparison matches only values of its operand's type, so `{ $gt: 4 }` matches no string or Date. Numbers and BigInts (`NumberLong`) compare as numbers.
- A condition matches an array when the array or one of its elements matches, so `{ tags: 'a' }` matches `['a', 'b']`. `$ne` and `$nin` match when none does.
- A dot path steps through arrays of documents: `'items.sku'` reads the `sku` of every item. A numeric segment indexes an array: `'items.0.sku'`.

- In `$regex`, `$` also matches before a final line break, and NaN equals NaN.

VERIFIED: tests/mongo-semantics.json holds the ids MongoDB 9.0.8 returned for 166 filters over 40 documents (scalars of every type, NaN, numbers around 2^53, null, missing, empty and nested arrays, arrays of documents). tests/mongo.test.ts gets the same ids from defuss-db. `scripts/mongo-semantics-fixture.mjs` records the file again against a server.

Most conditions become one `where` expression evaluated per document, since any field may hold an array. A top-level field that an index covers cannot hold one: indexes reject arrays when written and when built. Its `$eq $ne $gt $gte $lt $lte $in` conditions and its `$regex` conditions without `i`, except `suffix$`, therefore become `filters`. An equality or ordered index answers equality, and an ordered index answers ranges; the type rule adds one bound to a range, which the index still answers. `findMongo` and `aggregateMongo` read the collection's indexes for this; `mongoRequest` and `translateFilter` take them as `scalarFields`. One rule is narrower there: a filter on an indexed field matches only the operand's own kind of number, because the index keys numbers and BigInts apart. A view bound with `at(date)` (`historic` is true) keeps every condition in the `where` expression, because a past version may hold an array in a field indexed later.

A sort differs from MongoDB. It puts null and missing values last in ascending order, where MongoDB puts them first, and an array sorts after every scalar, in element order. MongoDB sorts an array by its smallest element ascending and its largest descending. VERIFIED: MongoDB 9.0.8 sorted `[1, 9]` before `3` ascending and before `5` descending, 2026-11-22.

Pipelines: `$match` (several are ANDed), `$unwind` (only as a group key: one group per element), `$group` (`_id`: a field, a document of fields, `$toLower`, `$toUpper`, `$year`, `$dateTrunc` with `binSize` and `startOfWeek` (Sunday by default, as in MongoDB), `$dateToString` with `%Y`, `%Y-%m`, `%Y-%m-%d` or `%Y-%m-%dT%H`, both with an optional IANA `timezone`; `$sum`, `$count`, `$avg`, `$min`, `$max`, `$addToSet`, `$stdDevPop`, `$stdDevSamp`), `$size` of an `$addToSet` in `$set` / `$addFields` / `$project`, `$sort` by one key or accumulator, `$limit` and the `$count` stage. Any other stage or operator throws a `QueryError` naming the stage.

`analyzeSchema(collection, { sample, at, $asOfRevision, maxDepth, examples, title }?)` (main entry) answers `{ schema, sampled, total, at }`. It reads at most `sample` documents (default 1,000): all of a smaller collection, else eight windows at even offsets, since default order follows storage keys and ids often follow insertion time. With `at` it reads the collection as it was then; a collection without history throws `HISTORY_NOT_ENABLED`. `inferSchema(docs, options?)` is the same inference over documents you hold. The schema is JSON Schema draft 2020-12: `type`, `properties`, `required` (properties every sampled object holds), `items`, `anyOf` where one place holds an object or array beside other types, and `examples` (up to three distinct scalars). A property some objects lack carries `x-presence`, the share that hold it. DSON values keep a JSON type and name their own in `x-dson`: a Date is `{ type: 'string', format: 'date-time', 'x-dson': 'date' }`, a BigInt an integer, binary a base64 string, a Map an object of `additionalProperties`, a Set an array of `uniqueItems`. A value that contains itself is a `$comment`, not an endless schema.

Interactive: [MongoDB syntax and schemas in the app](../../app-api-docs.html#/guides/mongodb-syntax-and-schemas).
