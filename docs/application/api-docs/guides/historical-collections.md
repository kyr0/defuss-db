# Historical collections

Use `await db.ensureCollection<T>(name, { $trackHistory: true })`. Calls on `collection.at(date)` share an effective instant. Add `{ $asOfRevision: receipt.revision }` to reproduce the database's earlier answer. `history(id)` lists effective segments and `audit(id)` lists recorded changes. [API, correction boundaries, search and backup](../../../guides/history.html)

Interactive: [Historical collections in the app](../../app-api-docs.html#/guides/historical-collections).
