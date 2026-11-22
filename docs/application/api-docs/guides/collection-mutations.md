# Collection mutations

The members are in the reference: [Collection](../../app-api-docs.html#/ref/Collection).

`updateMany`/`deleteMany` accept DataView query resource options alongside write options. Their collected output caps cannot exceed the transaction limits. A callback update can be asynchronous; it executes once, receives the current decoded document, and must preserve its typed ID. Patches cannot contain `id`. Upsert-by-ID is `put`; there is no ambiguous selector-based upsert.

`IndexDefinition`: `{ name, fields: string[], unique?: boolean }`. Unique indexes treat missing/undefined and null as distinct values, each allowed at most once for a given compound tuple. Ordinary objects/arrays/Maps/Sets cannot be index components. No prefix/range index use is claimed.

Interactive: [Collection mutations in the app](../../app-api-docs.html#/guides/collection-mutations).
