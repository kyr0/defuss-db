import type { Reader } from './types.js';
/** Drain every in-flight read before an error can release its pinned snapshot. Preserve request order. */
export async function settleReads<T>(pending: readonly Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(pending);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}
export async function readKeys(reader: Reader, keys: readonly string[], signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
  const results: Awaited<ReturnType<Reader['get']>>[] = [];
  for (let i = 0; i < keys.length; i += 8) {
    if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
    results.push(...(await settleReads(keys.slice(i, i + 8).map((key) => reader.get(key)))));
  }
  return results;
}
