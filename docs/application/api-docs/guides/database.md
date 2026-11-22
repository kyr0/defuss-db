# Database

The members are in the reference: [Database](../../app-api-docs.html#/ref/Database).

Write options accept `ifRevision` for whole-store compare-and-swap and `signal`. Revisions are database-wide, not per collection. A transaction object exposes `revision` and `collection<T>`. A transaction collection has the same read APIs and the mutation APIs below, without an independent commit option.

Interactive: [Database in the app](../../app-api-docs.html#/guides/database).
