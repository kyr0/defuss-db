// The message contract between the page and the database worker. The page sends { id, op, args }; the worker answers
// { id, ok, value } or { id, ok: false, error, code }, and posts { type: 'progress' } while it seeds. Every value that
// came from a database call carries a Trace: the TypeScript that ran, its measured time and the access plan.
import type { Order, OrderEdit, Price, Item, Status } from './records.js';

export interface Trace {
  /** One line: which call ran and what it returned. */
  what: string;
  /** Milliseconds measured in the worker around the database calls. */
  ms: number;
  /** The TypeScript that ran, with its real arguments. */
  code: string;
  /** explain().access where the call has one, e.g. "ordered index byRegionDate, prefix 1". */
  access?: string;
}

export interface Filter {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}
export interface Sorter {
  field: string;
  direction?: 'asc' | 'desc';
}
export interface GridQuery {
  filters: Filter[];
  sorters: Sorter[];
}

export interface StoreStatus {
  /** 'seeded': this visit created the data; 'reopened': it was already in OPFS. */
  opened: 'seeded' | 'reopened';
  openMs: number;
  seedMs: number | null;
  seededAt: Date;
  revision: number;
  storedEntries: number;
  committedBytes: number;
  compaction: string;
  trace: Trace;
}

export interface Progress {
  type: 'progress';
  step: string;
  done: number;
  total: number;
  /** Milliseconds since seeding started. */
  ms: number;
}

/** A display row for the price history: segment or recorded change of one SKU. */
export interface TimelineRow {
  id: string;
  from: Date;
  until: Date | null;
  eur: number | null;
  revision: number;
  kind?: string;
}

export interface AccountRow {
  id: string;
  name: string;
  /** EUR, converted from bigint cents for display. */
  balance: number;
  pinned: number | null;
}
export interface TransferRow {
  id: string;
  from: string;
  to: string;
  amount: number;
  at: Date;
}
export interface Treasury {
  accounts: AccountRow[];
  transfers: TransferRow[];
  /** The invariant, in cents as text: bigint does not survive JSON-like display code unchanged. */
  total: string;
  pinned: { revision: number; total: string } | null;
  revision: number;
  message: string;
  trace: Trace;
}

export interface Ops {
  'store.status': { args: Record<string, never>; result: StoreStatus };
  'store.reset': { args: Record<string, never>; result: StoreStatus };
  'store.counts': {
    args: Record<string, never>;
    result: { documents: Record<string, number>; trace: Trace };
  };
  'orders.page': {
    args: { query: GridQuery; offset: number; limit: number; after: string | null };
    result: { rows: Order[]; next: string | null; trace: Trace };
  };
  'orders.count': { args: { query: GridQuery }; result: { total: number; trace: Trace } };
  'orders.setStatus': {
    args: { id: string; status: Status };
    result: { order: Order; revision: number; trace: Trace };
  };
  'orders.edits': { args: Record<string, never>; result: { edits: OrderEdit[]; trace: Trace } };
  'reports.run': {
    args: { name: string };
    result: { rows: Record<string, unknown>[]; facts: [string, string | number][]; trace: Trace };
  };
  'prices.list': {
    args: { date: string; revision: number | null };
    result: { rows: Price[]; trace: Trace };
  };
  'prices.revisions': {
    args: Record<string, never>;
    result: { revisions: { revision: number; label: string }[]; latest: number };
  };
  'prices.timeline': {
    args: { id: string };
    result: { history: TimelineRow[]; audit: TimelineRow[]; trace: Trace };
  };
  'prices.correct': {
    args: { id: string; eur: number; from: string; until: string | null };
    result: { revision: number; trace: Trace };
  };
  'treasury.state': { args: Record<string, never>; result: Treasury };
  'treasury.transfer': { args: { from: string; to: string; cents: number }; result: Treasury };
  'treasury.fail': { args: { from: string; to: string; cents: number }; result: Treasury };
  'treasury.burst': { args: { count: number }; result: Treasury };
  'treasury.pin': { args: Record<string, never>; result: Treasury };
  'treasury.release': { args: Record<string, never>; result: Treasury };
  'catalog.search': {
    args: { query: string; page: number; pageSize: number; category: string; inStock: boolean };
    result: { rows: (Item & { score: number })[]; total: number; trace: Trace };
  };
}
export type Op = keyof Ops;
export interface Call<K extends Op = Op> {
  id: number;
  op: K;
  args: Ops[K]['args'];
}
export type Reply =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string; code?: string };
