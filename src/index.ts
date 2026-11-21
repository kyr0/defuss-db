/** Isomorphic entry: no filesystem, worker globals or native addons are imported here. */
export {
  openDatabase,
  openMemory,
  Database,
  DatabaseSnapshot,
  DatabaseTransaction,
} from './database.js';
export { Collection, TransactionCollection } from './collection.js';
export { ReadCollection } from './query.js';
export type { BoundQuery } from './query.js';
export { DatabaseError } from './errors.js';
export type { DatabaseErrorCode } from './errors.js';
export type {
  PrimaryKey,
  Document,
  NewDocument,
  Patch,
  Updater,
  IndexDefinition,
  IndexDirection,
  IndexPage,
  IndexPageOptions,
  IndexRangeOptions,
  IndexCountOptions,
  OrderedValue,
  OpenOptions,
  FindRequest,
  QueryOptions,
  Selection,
  DatabaseBackend,
  WriteOptions,
  TransactionResult,
  AccessPlan,
} from './types.js';
export { createMemoryBackend, DbsonlError } from 'defuss-dbsonl';
export { forRows } from 'defuss-dataview/compute';
export type {
  Expr,
  AggregateExpr,
  RowsDescriptor,
  AggregateDescriptor,
  ViewDescriptor,
  ComputeResult,
  ComputeEvent,
  ComputeSummary,
  ViewResult,
  Page,
} from 'defuss-dataview/compute';
export { StorageError } from 'defuss-storage';

export type * from './search-types.js';

export type { QueryCacheOptions, QueryCacheStats } from './query-cache.js';
export type { AutoCompactOptions, AutoCompactStats } from './compaction.js';
export type * from './archive-types.js';

export type {
  RecordedRevision,
  CollectionOptions,
  HistoryReadOptions,
  HistoryWriteOptions,
  HistoryListOptions,
  HistorySegment,
  HistoryChange,
} from './history-types.js';
