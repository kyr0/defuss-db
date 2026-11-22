# defuss-db reference

Every documented function and method of defuss-db, grouped by what you call it on.

| Namespace | Kind | Members | Description |
| --- | --- | --- | --- |
| [Opening](Opening.md) | module | 4 | Functions that open a database: in memory or on a DBSONL backend (defuss-db), in a directory (defuss-db/server, Node.js and Bun) or in OPFS (defuss-db/browser, a dedicated worker). Each returns a Database. |
| [Database](Database.md) | class | 15 | What opening returns: typed collections, transactions across collections, snapshots, archives, statistics and maintenance. |
| [Collection](Collection.md) | class | 40 | A collection of documents. db.collection(name) returns one without I/O; each write commits in its own transaction, and the reads are the same on snapshots and in transactions. |
| [Mongo](Mongo.md) | module | 12 | defuss-db/mongo: MongoDB filter, sort, projection and pipeline documents on any collection - a Collection, a view from at(date) or a TransactionCollection. |

Interactive: [Reference in the app](../../app-api-docs.html#/ref).
