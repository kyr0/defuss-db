export type DatabaseErrorCode =
  | 'DUPLICATE_KEY'
  | 'NOT_FOUND'
  | 'SCHEMA_MISMATCH'
  | 'INVALID_DOCUMENT'
  | 'INVALID_INDEX_VALUE'
  | 'CORRUPT'
  | 'CLOSED'
  | 'INVALID_CURSOR'
  | 'STALE_CURSOR'
  | 'HISTORY_ACTIVATING'
  | 'HISTORY_NOT_ENABLED'
  | 'HISTORY_UNAVAILABLE'
  | 'HISTORY_READ_ONLY'
  | 'HISTORY_FUTURE_WRITE'
  | 'HISTORY_RANGE'
  | 'BUSY'
  | 'UNFINISHED_TRANSACTION';
/** DBSONL and Storage errors retain their original codes and causes. */
export class DatabaseError extends Error {
  constructor(
    readonly code: DatabaseErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DatabaseError';
  }
}
