import type { Document } from './types.js';

/** Local revisions are DBSONL commit receipts. Qualify a source receipt after restoring a backup. */
export type RecordedRevision = number | { storeId: string; revision: number };
export interface HistoryReadOptions {
  $historic?: Date;
  $asOfRevision?: RecordedRevision;
}
export interface HistoryWriteOptions extends HistoryReadOptions {
  /** Exclusive. May shorten a correction inside one effective slice. */
  $until?: Date;
}
export interface CollectionOptions {
  $trackHistory?: boolean;
  historyBatchSize?: number;
  signal?: AbortSignal;
}
export interface HistorySettings {
  coverageFrom: number | null;
}
export interface HistorySegment<T extends Document> {
  from: Date;
  until: Date | null;
  document: T | undefined;
  revision: number;
  ordinal: number;
}
export interface HistoryChange<T extends Document> extends HistorySegment<T> {
  kind: 'seed' | 'put' | 'delete';
  /** Original store and actual committed revision, retained across backup generations. */
  recorded: { storeId: string; revision: number };
}
export interface HistoryListOptions {
  $asOfRevision?: RecordedRevision;
  limit?: number;
  signal?: AbortSignal;
}
export interface TimeScope {
  time: number;
  cutoff?: RecordedRevision;
  until?: number;
}
export const epoch = (date: Date) => {
  let ms: number;
  try {
    ms = Date.prototype.getTime.call(date);
  } catch {
    throw new TypeError('Expected a Date.');
  }
  if (!Number.isFinite(ms)) throw new RangeError('Invalid Date.');
  return ms;
};
export function recorded(value?: RecordedRevision): RecordedRevision | undefined {
  if (value === undefined) return;
  const rev = typeof value === 'number' ? value : value?.revision;
  if (!Number.isSafeInteger(rev) || rev < 0) throw new RangeError('Invalid recorded revision.');
  if (typeof value === 'number') return value;
  if (!value || !/^[a-f0-9-]{36}$/.test(value.storeId))
    throw new TypeError('Invalid source store ID.');
  return { storeId: value.storeId, revision: rev };
}
export function timeScope(input?: HistoryWriteOptions, bound?: TimeScope): TimeScope | undefined {
  if (
    !input ||
    (input.$historic === undefined &&
      input.$asOfRevision === undefined &&
      input.$until === undefined)
  )
    return bound;
  const time = input.$historic === undefined ? bound?.time : epoch(input.$historic);
  if (time === undefined)
    throw new TypeError('A recorded cutoff or exclusive end requires an effective date.');
  if (
    bound &&
    ((input.$historic !== undefined && time !== bound.time) ||
      (input.$asOfRevision !== undefined &&
        bound.cutoff !== undefined &&
        JSON.stringify(recorded(input.$asOfRevision)) !== JSON.stringify(bound.cutoff)))
  )
    throw new TypeError('Conflicting historical scope.');
  const until = input.$until === undefined ? bound?.until : epoch(input.$until);
  if (until !== undefined && until <= time)
    throw new RangeError('The exclusive end must follow the start.');
  return { time, cutoff: recorded(input.$asOfRevision) ?? bound?.cutoff, until };
}
