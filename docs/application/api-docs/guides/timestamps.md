# Timestamps

`await db.ensureCollection<Timestamped<T>>(name, { $timestamps: true })` makes every write set `_createdAt` and `_updatedAt` as Dates. Use `Timestamped<T>` from the package as the document type; it removes both fields from the insert and patch types. A document type that keeps its own `_createdAt` in an ordinary collection still writes it. One transaction stamps all its documents with one time. In a tracked collection that time is the history clock, so `_updatedAt` equals the `from` of the version the write records. `_createdAt` survives updates, replacements and `restore()`. `_updatedAt` never moves back for one document, even after a write from a host whose clock ran ahead. Indexes may name both fields; an ordered index on `_updatedAt` stays current under patches that do not name it.

Callers omit both fields or pass their stored values unchanged, so a read document can go back through `put()`. Other values raise `INVALID_DOCUMENT`. Timestamped collections take current writes only; `at(date).put()` raises `HISTORY_READ_ONLY`, because a backdated version would leave the stamps of later versions wrong. The setting is persistent; `$timestamps: false` on a timestamped collection raises `SCHEMA_MISMATCH`.

Turning timestamps on for a collection that holds documents stamps them in batches of up to 128 per transaction, with the time of their batch, since their creation time is unknown. A document that already holds both fields as Dates, `_createdAt` not after `_updatedAt`, keeps them; one that holds only a valid `_createdAt` Date, or the pair in the wrong order, keeps its `_createdAt`. Writes between batches stamp themselves. An interrupted pass keeps a cursor; the next `ensureCollection` with `$timestamps: true`, from any process, resumes it, and once it has finished the call reads one key. Stamping runs before history activation, so the baseline seeds stamped documents. Archive imports keep the stamps they carry. VERIFIED: tests/timestamps.test.ts.

DSON stores a Date in 17 bytes, as many as an epoch-millisecond number. Dates work in ordered indexes, range filters, `min`/`max`, `dateTrunc` and `datePart`. For durations, `q.epochMs` turns a Date into epoch milliseconds: `q.sub(q.epochMs(q.field('_updatedAt')), q.epochMs(q.field('_createdAt')))` is the time between a document's creation and its last write, and `avg`, `max` or `percentile` over it aggregate durations. `sub` on two Dates still raises a TypeError, so a forgotten `epochMs` never gives `NaN`.


All methods use the same APIs on memory, files and OPFS. See generated `.d.mts`/`.d.cts` declarations for exact generic result inference.

Interactive: [Timestamps in the app](../../app-api-docs.html#/guides/timestamps).
