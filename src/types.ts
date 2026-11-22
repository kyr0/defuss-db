import type { HistoryReadOptions, HistorySettings, HistoryWriteOptions } from './history-types.js';
import type { QueryCache, QueryCacheOptions } from './query-cache.js';
import type { AutoCompactOptions } from './compaction.js';
import type { SearchIndexDefinition } from './search-types.js';
import type { SearchCache } from './search.js';
import type { Options, Backend, CommitOptions, Transaction, ReadSession } from 'defuss-dbsonl';
import type { ComputeOptions, Expr, Page, PlanOptions } from 'defuss-dataview/compute';
import type { DataviewSorter } from 'defuss-dataview';

export type PrimaryKey = string | number | bigint;
/** IDs are stored with their type; 1, 1n and '1' address different documents. */
export interface Document {
  id: PrimaryKey;
}
/** The fields a collection opened with `$timestamps: true` maintains. */
export type TimestampField = '_createdAt' | '_updatedAt';
declare const maintained: unique symbol;
/**
 * A document of a timestamped collection: defuss-db sets both Dates on every write. A type-only brand marks it, so a
 * document type that keeps its own `_createdAt` in an ordinary collection still writes that field.
 * VERIFIED: the types consumer in scripts/e2e.mjs rejects an inserted `_createdAt` on Timestamped<T> and accepts one on an
 * ordinary type, against the packed declarations.
 */
export type Timestamped<T extends Document> = T & {
  _createdAt: Date;
  _updatedAt: Date;
  readonly [maintained]: true;
};
type Stamped = { readonly [maintained]: true };
type Written<T> = T extends Stamped ? TimestampField | typeof maintained : never;
export type NewDocument<T extends Document> = string extends T['id']
  ? Omit<T, 'id' | Written<T>> & { id?: T['id'] }
  : T extends Stamped
    ? Omit<T, Written<T>>
    : T;
/** A whole document for put(): in a timestamped collection the timestamps may be omitted or keep their stored values. */
export type Replacement<T extends Document> = T extends Stamped
  ? Omit<T, Written<T>> & Partial<Pick<T, Extract<keyof T, TimestampField>>>
  : T;
export type Patch<T extends Document> = Partial<Omit<T, 'id' | Written<T>>>;
export type Updater<T extends Document> = Patch<T> | ((current: T) => T | Promise<T>);
export type IndexDirection = 'asc' | 'desc';
export type OrderedValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Date
  | ArrayBuffer
  | ArrayBufferView;
export interface IndexRangeOptions extends HistoryReadOptions {
  /** Fixed leading sort-key components. Range bounds apply to the following component in natural order. */
  prefix?: readonly OrderedValue[];
  gt?: OrderedValue;
  gte?: OrderedValue;
  lt?: OrderedValue;
  lte?: OrderedValue;
  signal?: AbortSignal;
}
export interface IndexCountOptions extends IndexRangeOptions {
  /** Reject when the interval exceeds this many entries. The count is exact on success. */
  maxScannedEntries?: number;
}
export interface IndexPageOptions extends IndexRangeOptions {
  after?: string;
  limit?: number;
  maxOutputBytes?: number;
}
export interface IndexPage<T> {
  rows: T[];
  nextCursor: string | null;
  revision: number;
}
export interface IndexDefinition {
  name: string;
  /** Tuple fields in declaration order. Supported leaves include scalar, Date and binary values. */
  fields: readonly string[];
  unique?: boolean;
  /** Require a single owner at every effective instant in a tracked collection. */
  temporalUnique?: boolean;
  /** One direction per field enables a persisted ordered index. Uniqueness is declared on a separate equality index. */
  order?: readonly IndexDirection[];
}
export interface Schema {
  version: 1;
  history?: HistorySettings;
  /** `_createdAt` and `_updatedAt` maintained on every write. */
  timestamps?: true;
  activating?: { from: number; after: string };
  indexes: IndexDefinition[];
  searchIndexes: SearchIndexDefinition[];
}
export interface OpenOptions extends Options {
  name?: string;
  /** Bounded cache storage. Automatic admission by default; queryCache.mode: manual caches only requested queries. */
  queryCache?: false | QueryCacheOptions;
  /** Background compaction after commits once the file outgrows its live size. false disables it. */
  autoCompact?: false | AutoCompactOptions;
}
export interface FindRequest extends PlanOptions, Page, HistoryReadOptions {
  sorters?: readonly DataviewSorter[];
  /** 'scan' is useful for diagnostics and indexed-versus-scan equivalence tests. */
  access?: 'auto' | 'scan';
}
export type QueryOptions<T extends Document> = ComputeOptions<T> &
  HistoryReadOptions & {
    cache?: boolean | 'auto' | 'refresh';
  };
export interface Selection extends PlanOptions, HistoryReadOptions {
  access?: 'auto' | 'scan';
}
export type DatabaseBackend = Backend;
export type WriteOptions = CommitOptions & HistoryWriteOptions;
export interface AccessPlan {
  kind: 'scan' | 'primary' | 'primary-in' | 'equality' | 'ordered' | 'range';
  equalityPrefix?: number;
  rangeField?: string;
  pointKeys?: number;
  index?: string;
  unique?: boolean;
  /** One direction per field enables a persisted ordered index. Uniqueness is declared on a separate equality index. */
  order?: readonly IndexDirection[];
}
export interface WriteResult {
  revision: number;
  storedEntries: number;
}
export type TransactionResult<R> = WriteResult & { result: R };
export interface MutationLimits {
  maxRecordBytes: number;
  maxTransactionBytes: number;
  maxTransactionOperations: number;
}
export interface Reader {
  readonly temporal?: boolean;
  /** Historical views: whether an index left out no version a query could match (built lazily on the first call). */
  readonly indexComplete?: (index: IndexDefinition) => Promise<boolean>;
  readonly searchGeneration?: () => Promise<string>;
  readonly temporalVersion?: () => Promise<number>;
  readonly revision: number;
  get: ReadSession<unknown>['get'];
  scan: ReadSession<unknown>['scan'];
  scanBatches?: ReadSession<unknown>['scanBatches'];
}
export type Writer = Transaction<unknown>;
export interface SnapshotLease {
  reader: Reader;
  close(): Promise<void>;
}
export interface ReadContext {
  /** Store UUID for live/snapshot pages, or scope identity for transaction pages. */
  cursorIdentity?: () => string | undefined;
  cursorMutation?: () => number;
  searchCache?: SearchCache;
  queryCache?: QueryCache;
  /** Only the live database context may retain bound plans. */
  cachePlans?: boolean;
  cacheNamespace?: string;
  temporalScope?: import('./history-types.js').TimeScope;
  temporalParent?: ReadContext;
  /** Historical cursor continuations reopen their original recorded basis. */
  atRevision?: (revision: number) => ReadContext;
  lookupConcurrency?: number;
  /**
   * Worker threads for mergeable full-scan aggregates. VERIFIED: only Database and DatabaseSnapshot contexts set it
   * (database.ts), so transactions and history views run in one thread.
   */
  parallel?: import('./parallel.js').PartialRunner;
  check(): void;
  open(): Promise<SnapshotLease>;
  get(key: string): ReturnType<Reader['get']>;
}
export type { ComputeOptions, Expr };
