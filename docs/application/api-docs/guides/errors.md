# Errors

`DatabaseError` codes: `DUPLICATE_KEY`, `SCHEMA_MISMATCH`, `INVALID_DOCUMENT`, `VALIDATION_FAILED` (a `ValidationError` with `issues`), `NOT_FOUND` (`validateDocument` of a missing id), `INVALID_INDEX_VALUE`, `CORRUPT`, `INVALID_CURSOR`, `STALE_CURSOR`, `CLOSED`, `BUSY`, `UNFINISHED_TRANSACTION`, and for history `HISTORY_ACTIVATING`, `HISTORY_NOT_ENABLED`, `HISTORY_UNAVAILABLE`, `HISTORY_READ_ONLY`, `HISTORY_FUTURE_WRITE`, `HISTORY_RANGE`. Input validation can also throw `TypeError`/`RangeError`; strict DSON errors remain intact.

DBSONL errors (`CONFLICT`, `COMMIT_UNCERTAIN`, `LIMIT_EXCEEDED`, `QUEUE_FULL`, `ABORTED`, corruption etc.), DataView errors, and Storage errors retain their original codes/causes. `COMMIT_UNCERTAIN` means publication status must be inspected before retrying; never blindly retry non-idempotent writes. Capacity limits, unsupported platforms and browser quota errors fail explicitly. Nothing silently downgrades durability or repairs corruption.

Interactive: [Errors in the app](../../app-api-docs.html#/guides/errors).
