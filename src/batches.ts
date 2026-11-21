import type { Row } from 'defuss-dbsonl';
import type { Reader } from './types.js';

export type BatchReader = { scanBatches: NonNullable<Reader['scanBatches']> };
type ScanSignal = NonNullable<Parameters<Reader['scan']>[0]>['signal'];

/**
 * VERIFIED: defuss-dataview 0.7.0 measured that starting defuss-dbsonl 0.7.0's worker pool raised a 50-row first page
 * over 100,000 file rows from 1.5 to 15 ms. dbsonl stays in the calling thread for limits below its threshold (5,000
 * rows by default), so this many rows come first from a bounded scan and short pages never start the pool.
 */
export const PREFIX_ROWS = 4096;

/**
 * Batches a pool may scan. VERIFIED: defuss-dbsonl 0.7.0 runs only scans without `sizeOf` in its workers, because a
 * function cannot be sent to a worker, and applies `maxBatchBytes` to encoded frame bytes; callers therefore measure rows
 * themselves (a 100,000-document aggregate took 83 ms this way against 125 ms with `sizeOf`). The rest continues at the last key, skipping that row: the key after it can exceed dbsonl's key length.
 */
export async function* poolBatches(
  reader: BatchReader,
  options: { gte?: string; lt?: string; signal?: ScanSignal; batchSize: number },
): AsyncGenerator<readonly Row<unknown>[]> {
  const input = { ...options, maxBatchBytes: Number.MAX_SAFE_INTEGER };
  let read = 0,
    last: string | undefined;
  for await (const batch of reader.scanBatches({ ...input, limit: PREFIX_ROWS })) {
    read += batch.length;
    last = batch[batch.length - 1]?.key;
    yield batch;
  }
  if (read < PREFIX_ROWS || last === undefined) return;
  let first = true;
  for await (const batch of reader.scanBatches({ ...input, gte: last })) {
    if (first && batch[0]?.key === last) {
      first = false;
      if (batch.length > 1) yield batch.slice(1);
      continue;
    }
    first = false;
    yield batch;
  }
}

/** Splits a batch into spans of at most `maxBatchBytes`; a row over the budget alone is left for DataView to reject. */
export function* spans<T>(
  rows: readonly T[],
  measure: (row: T) => number,
  maxBatchBytes: number,
): Generator<readonly T[]> {
  let start = 0,
    bytes = 0;
  for (let i = 0; i < rows.length; i++) {
    const size = measure(rows[i]!);
    if (i > start && bytes + size > maxBatchBytes) {
      yield rows.slice(start, i);
      start = i;
      bytes = 0;
    }
    bytes += size;
  }
  if (start < rows.length) yield start ? rows.slice(start) : rows;
}
