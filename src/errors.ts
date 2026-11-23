import type { ValidationIssue } from './validate.js';

export type DatabaseErrorCode =
  | 'DUPLICATE_KEY'
  | 'NOT_FOUND'
  | 'SCHEMA_MISMATCH'
  | 'INVALID_DOCUMENT'
  | 'VALIDATION_FAILED'
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
/**
 * A write that violates the schema set on its collection: `issues` names each violated rule by JSON Pointer. Why a
 * code and class of its own instead of INVALID_DOCUMENT: a form shows the issues per field.
 * VERIFIED: tests/schema-validation.test.ts asserts code, collection, id, issues and message of a refused insert.
 */
export class ValidationError extends DatabaseError {
  constructor(
    readonly collection: string,
    readonly id: unknown,
    readonly issues: readonly ValidationIssue[],
  ) {
    const first = issues[0]!;
    const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : '';
    super(
      'VALIDATION_FAILED',
      `Document ${String(id)} violates the schema of ${collection}: ${first.path || '/'} ${first.message}${more}.`,
    );
    this.name = 'ValidationError';
  }
}
