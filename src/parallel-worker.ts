/** A query pool worker: its own synchronous native handle, answering one key range of a pinned snapshot per task. */
import { parentPort, workerData } from 'node:worker_threads';
import { openDbsonl } from 'defuss-dbsonl';
import type { Head, Options } from 'defuss-dbsonl';
import { createFileBackend } from 'defuss-dbsonl/server';
import type { FileBackendOptions } from 'defuss-dbsonl/server';
import { forRows } from 'defuss-dataview/compute';
import { estimateRowBytes } from 'defuss-dataview/stream';
import type { RecordSource } from 'defuss-dataview/stream';
import { spans } from './batches.js';
import { measuredQueue, sourceMeasure } from './measured.js';

export type ToWorker =
  | {
      type: 'partial';
      id: number;
      head: Readonly<Head>;
      range: { gte?: string; lt?: string };
      descriptor: object;
      options: Record<string, number>;
    }
  | { type: 'cancel'; id: number }
  | { type: 'exit' };
export type FromWorker =
  | { type: 'ready' }
  | { type: 'closed' }
  | { type: 'partial'; id: number; partial: unknown }
  | { type: 'error'; id: number; code?: string; message: string };

const { root, name, storage, store } = workerData as {
  root: string;
  name: string;
  storage: FileBackendOptions;
  store: Options;
};
const port = parentPort!;
// VERIFIED: defuss-dbsonl 0.7.0 recommends { io: 'sync' } in worker threads, because asynchronous reads share the
// process's libuv thread pool; a worker has nothing else to run. Its own scan pool stays off: a pool per worker would
// oversubscribe the CPUs.
const db = await openDbsonl<unknown>(
  await createFileBackend(root, { ...storage, io: 'sync', scanWorkers: 0 }),
  name,
  store,
);
const running = new Map<number, AbortController>();

/** Document values of one key range at one head; DataView measures each row through the queue once. */
function rangeSource(head: Readonly<Head>, bounds: { gte?: string; lt?: string }) {
  const source: RecordSource<object> = {
    async open() {
      const session = await db.beginRead({ at: head });
      return {
        revision: session.revision,
        consistency: 'snapshot' as const,
        async *scan(request) {
          const measure = sourceMeasure(request.sizeOf);
          for await (const batch of session.scanBatches({
            ...bounds,
            signal: request.signal,
            batchSize: request.batchSize,
            maxBatchBytes: Number.MAX_SAFE_INTEGER,
          }))
            for (const span of spans(
              batch,
              (row) => measure(row.value as object),
              request.maxBatchBytes,
            ))
              yield span.map((row) => row.value as object);
        },
        close: () => session.close(),
      };
    },
  };
  return source;
}

async function answer(task: Extract<ToWorker, { type: 'partial' }>) {
  const abort = new AbortController();
  running.set(task.id, abort);
  try {
    const plan = forRows<object>().aggregate(task.descriptor as never);
    const partial = await plan.partial(rangeSource(task.head, task.range), {
      ...task.options,
      sizeOf: measuredQueue(estimateRowBytes),
      signal: abort.signal,
    });
    port.postMessage({ type: 'partial', id: task.id, partial } satisfies FromWorker);
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    port.postMessage({
      type: 'error',
      id: task.id,
      code,
      message: String(message),
    } satisfies FromWorker);
  } finally {
    running.delete(task.id);
  }
}

port.on('message', (message: ToWorker) => {
  if (message.type === 'partial') void answer(message);
  else if (message.type === 'cancel') running.get(message.id)?.abort();
  else void db.close().finally(() => port.postMessage({ type: 'closed' } satisfies FromWorker));
});
port.postMessage({ type: 'ready' } satisfies FromWorker);
