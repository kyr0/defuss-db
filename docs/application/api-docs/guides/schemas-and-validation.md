# Schemas and validation

`collection.setSchema(schema)` sets the JSON Schema of a collection, typically an `analyzeSchema` result after review. From that commit on, `insert`, `insertMany`, `insertBatches`, `put`, `update`, `updateMany` and `restore` validate the whole document they store, in a timestamped collection after `_createdAt` and `_updatedAt` are set. A violating write rejects with a `ValidationError` (code `VALIDATION_FAILED`) that carries `collection`, `id` and `issues: { path, keyword, message }[]`, where `path` is a JSON Pointer into the document; a batch or transaction stores none of its documents. `setSchema(null)` removes the schema.

Documents the collection already holds are not checked when a schema is set, so a schema never blocks on old data. `setSchema` answers `{ checked, invalid, limit, documents, warning? }`: it reads the collection in key order and stops at `limit` violating documents (default 100). When `invalid` equals `limit` the count is a lower bound, and `warning` says so: `WARNING >= 100 documents of events violate its schema; first: ev-000007 /type "x" is not one of "search", "click"`. `validateCollection({ limit })` repeats the check and `validateDocument(id)` checks one document. A violating document stays readable and deletable; an update has to leave it conforming. In a transaction, `setSchema` returns nothing and governs the writes that follow in it.

`{ validate: false }` on `insert`, `insertMany`, `insertBatches`, `put`, `update`, `updateMany` or `restore` stores the documents of that call without checking them, for a bulk import of data that predates the schema. The option belongs to its call: the next write of such a document is checked, and `validateCollection()` lists the documents that violate the schema. `restore(id)` validates the version it writes back, so `restore(id, { validate: false })` is the way to restore a version that predates the schema. VERIFIED: tests/schema-validation.test.ts.

A write that began before a schema was set cannot commit after it: each write transaction reads whether its collection has a schema, and that read is part of its conflict set, so the late commit fails with `CONFLICT`. VERIFIED: tests/schema-validation.test.ts.

Enforced keywords: `type` (one or a list), `enum` (strings, numbers, booleans, null), `format`, `properties`, `required`, `additionalProperties` (a schema or a boolean), `items`, `anyOf` and `x-dson`. `title`, `description`, `examples`, `default`, `$comment`, `$schema`, `$id`, `contentEncoding` and every `x-` keyword are annotations. `setSchema` and `checkSchema(schema)` refuse any other keyword and any other format with a `TypeError` that names it and its place, for example `Schema /properties/a: "pattern" is not enforced by defuss-db`. JSON Schema would let a validator ignore them; a stored schema would then state a rule that no write checks.

| `format` | A string conforms when |
| --- | --- |
| `uri` | it holds no whitespace and `URL.canParse` accepts it |
| `path` | it is not empty and holds no whitespace or control character. `path` is no JSON Schema format; other validators ignore it |
| `date-time` | it is an RFC 3339 date-time |

With `x-dson` a value must have that DSON type: `{ type: 'string', format: 'date-time', 'x-dson': 'date' }` accepts a Date and no string, `'x-dson': 'bigint'` a BigInt, `binary` a typed array or ArrayBuffer, `map` a Map whose values match `additionalProperties`, `set` a Set whose items match `items`. Without it, `integer` is a JavaScript integer number and `number` any number.

`validateValue(schema, value)` (main entry) is the check `setSchema` installs, as a pure function: it answers the issues of any value against any schema or sub-schema, at most 100. A form can validate one field with `validateValue(schema.properties.country, input)` and offer `schema.properties.country.enum` as choices before it writes.

`_collections` is the catalog of a database: one document `{ id: <collection>, schema? }` per collection that `ensureCollection()` or `setSchema()` named. A collection that only document writes created has no entry, because creating one on the first write would make concurrent first writers conflict. `db.collection('_collections')`, also on a transaction and a snapshot, is a `ReadCollection`: `find`, `get`, `count` and the other reads work, and it has no write methods. Its name is no valid collection name, `collections()` leaves it out, and `verify()` checks that every entry names a collection and parses. The schema is not versioned: `at(date)` reads documents of the past and `schema()` answers the schema set today. Archives carry the entries, see [Archive API](../../../guides/archive.html).

Interactive: [Schemas and validation in the app](../../app-api-docs.html#/guides/schemas-and-validation).
