import type {
  ComputeResult,
  MergeOptions,
  Page,
  PartialAggregate,
  PreparedAggregate,
} from 'defuss-dataview/compute';
import type { Head, ReadSession } from 'defuss-dbsonl';
import { documentPrefix, range } from './keys.js';
import { planAccess } from './source.js';
import type { Document, QueryOptions, ReadContext, Reader, Selection } from './types.js';

/** One aggregate over key ranges of one pinned snapshot, one range per worker. */
export interface PartialTask {
  collection: string;
  head: Readonly<Head>;
  ranges: { gte?: string; lt?: string }[];
  /** The descriptor the plan was prepared from; workers rebuild the plan from it, so their signatures match. */
  descriptor: object;
  options: Partial<Record<(typeof PARTIAL_KEYS)[number], number>>;
}
export interface ParallelStats {
  /** idle: no workers run; the next eligible aggregate starts them and runs in the calling thread meanwhile. */
  state: 'idle' | 'starting' | 'ready' | 'failed' | 'closed';
  workers: number;
  minRows: number;
  /** Aggregates answered by merged worker partials. */
  queries: number;
  /** Aggregates that went to the workers and then ran in one thread because a worker failed. */
  fallbacks: number;
  /** Times the pool started its workers. */
  starts: number;
  /** Why the last start failed, while state is failed. */
  error?: string;
}
/** DataView's polled cancellation signal; an AbortSignal qualifies. */
export interface Cancellation {
  readonly aborted: boolean;
  readonly reason?: unknown;
}
export interface PartialRunner {
  readonly workers: number;
  readonly minRows: number;
  /** undefined while the workers start or after they failed: the caller then scans in one thread. */
  partials(task: PartialTask, signal?: Cancellation): Promise<PartialAggregate[]> | undefined;
  stats(): ParallelStats;
  close(): Promise<void>;
}
export interface PreparedPartials<T extends Document, R> {
  plan: PreparedAggregate<T, R>;
  descriptor: object;
}

// Options a part applies to its own range. maxScannedRows bounds the whole query, so it keeps the query in one thread.
const PARTIAL_KEYS = [
  'batchSize',
  'maxBatchBytes',
  'maxRowBytes',
  'yieldEveryBatches',
  'maxWorkingBytes',
  'maxGroups',
] as const;
const MERGE_KEYS = [
  'batchSize',
  'maxBatchBytes',
  'maxWorkingBytes',
  'maxGroups',
  'maxOutputRows',
  'maxOutputBytes',
] as const;
function pick<K extends string>(input: object | undefined, keys: readonly K[]) {
  const out: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const value = (input as Record<string, unknown> | undefined)?.[key];
    if (value !== undefined) out[key] = value as number;
  }
  return out;
}

/**
 * Captures the descriptor at preparation time, so a caller who mutates it afterwards cannot make the workers build
 * another plan. undefined when the plan cannot merge, or when the descriptor holds a value postMessage cannot send.
 */
export function preparePartials<T extends Document, R>(
  plan: PreparedAggregate<T, R>,
  descriptor: object,
): PreparedPartials<T, R> | undefined {
  // VERIFIED: defuss-dataview 0.7.0 lists 'merge' for aggregates without sum or avg, and for all under numberMode 'exact'.
  if (!plan.explain().strategies.includes('merge')) return undefined;
  try {
    return { plan, descriptor: structuredClone(descriptor) };
  } catch {
    return undefined;
  }
}

type Session = Reader & Partial<Pick<ReadSession<unknown>, 'head' | 'split'>>;

/**
 * Answers an aggregate from partial aggregates of worker threads, or returns undefined so the caller runs it in one
 * thread. Only full scans of current documents qualify: an index already narrows its scan, a transaction's staged
 * writes are invisible to other handles, and a history view reads other keys. VERIFIED: tests/parallel.test.ts checks
 * that merged results equal one thread and that each excluded case stays there.
 */
export async function parallelAggregate<T extends Document, R>(
  prepared: PreparedPartials<T, R>,
  context: ReadContext,
  collection: string,
  selection: Selection,
  page: Page | undefined,
  input: QueryOptions<T> | undefined,
): Promise<ComputeResult<R> | undefined> {
  const runner = context.parallel;
  if (!runner || input?.sizeOf || input?.sizeOfOutput || input?.profile) return undefined;
  if (input?.maxScannedRows !== undefined) return undefined;
  const signal = input?.signal;
  const lease = await context.open();
  try {
    const reader = lease.reader as Session;
    if (reader.temporal || !reader.head || !reader.split) return undefined;
    // The whole store holds fewer entries than the threshold: no range split needed to know the answer.
    if (reader.head.count < runner.minRows) return undefined;
    if ((await planAccess(reader, collection, selection, signal)).public.kind !== 'scan')
      return undefined;
    const parts = (await reader.split(runner.workers, range(documentPrefix(collection)))).filter(
      (part) => part.count > 0,
    );
    if (parts.reduce((rows, part) => rows + part.count, 0) < runner.minRows) return undefined;
    const pending = runner.partials(
      {
        collection,
        head: reader.head,
        ranges: parts.map(({ gte, lt }) => ({ gte, lt })),
        descriptor: prepared.descriptor,
        options: pick(input, PARTIAL_KEYS),
      },
      signal,
    );
    if (!pending) return undefined;
    let partials: PartialAggregate[];
    try {
      partials = await pending;
    } catch (error) {
      if (signal?.aborted) throw error;
      // A data or limit error recurs in one thread with its own type; a crashed worker costs one slower query.
      return undefined;
    }
    const options: MergeOptions = { ...pick(input, MERGE_KEYS), ...(signal && { signal }) };
    return await prepared.plan.merge(partials, page, options);
  } finally {
    await lease.close();
  }
}
