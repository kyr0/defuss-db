import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { PartialAggregate } from 'defuss-dataview/compute';
import type { Options } from 'defuss-dbsonl';
import type { FileBackendOptions } from 'defuss-dbsonl/server';
import type { Cancellation, ParallelStats, PartialRunner, PartialTask } from './parallel.js';
import type { FromWorker, ToWorker } from './parallel-worker.js';

export interface ParallelOptions {
  /** Worker threads, each with its own database handle. Default: one fewer than the CPUs, at most 8. */
  workers?: number;
  /** Documents a collection must hold before an aggregate runs in the workers. Default 1,000. */
  minRows?: number;
}
export interface PoolTarget {
  root: string;
  name: string;
  storage: FileBackendOptions;
  store: Options;
}

// VERIFIED: 8 workers answered a grouped aggregate over 1,000 directory documents in 1.5 ms against 3.5 ms in one thread,
// and tied at 200 documents (0.7 against 0.6 ms).
const MIN_ROWS = 1000;
const MAX_WORKERS = 8;
/** Workers close after this long without a query, releasing their handles and page caches. VERIFIED: DBSONL's scan pool uses 30 s too. */
const IDLE_MS = 30_000;
/** A pool that failed to start is tried again on a query after this long. */
const RETRY_MS = 10_000;

export function parallelSettings(options: true | ParallelOptions) {
  const input = options === true ? {} : options;
  const workers = input.workers ?? Math.max(1, Math.min(MAX_WORKERS, availableParallelism() - 1));
  const minRows = input.minRows ?? MIN_ROWS;
  if (!Number.isSafeInteger(workers) || workers < 1 || workers > 256)
    throw new RangeError('parallel.workers must be an integer from 1 to 256.');
  if (!Number.isSafeInteger(minRows) || minRows < 0)
    throw new RangeError('parallel.minRows must be a non-negative integer.');
  return { workers, minRows };
}

/**
 * The built package ships parallel-worker.mjs beside this module. From TypeScript source (the test suite), Node
 * loads parallel-worker.ts by stripping its types, with a resolver that maps .js import specifiers to .ts files.
 */
function spawn(target: PoolTarget): Worker {
  const source = import.meta.url.endsWith('.ts');
  const hook =
    'export async function resolve(s, c, n) { try { return await n(s, c); } catch (e) { if (s.startsWith(".") && s.endsWith(".js")) return n(s.slice(0, -3) + ".ts", c); throw e; } }';
  const boot = `import { register } from 'node:module'; register(${JSON.stringify(`data:text/javascript,${encodeURIComponent(hook)}`)});`;
  const execArgv =
    source && !(process.versions as { bun?: string }).bun
      ? ['--no-warnings', '--import', `data:text/javascript,${encodeURIComponent(boot)}`]
      : undefined;
  return new Worker(
    new URL(source ? './parallel-worker.ts' : './parallel-worker.mjs', import.meta.url),
    { workerData: target, ...(execArgv && { execArgv }) },
  );
}

/** Resolves once the worker reports ready; rejects if it fails or exits first. */
function ready(worker: Worker) {
  return new Promise<void>((resolve, reject) => {
    const settle = (error?: Error) => {
      worker.off('error', failed);
      worker.off('exit', exited);
      worker.off('message', started);
      if (error) reject(error);
      else resolve();
    };
    const failed = (error: Error) => settle(error);
    const exited = (code: number) => settle(new Error(`Query worker exited with code ${code}.`));
    const started = (message: FromWorker) =>
      settle(message.type === 'ready' ? undefined : new Error('Query worker did not start.'));
    worker.on('error', failed);
    worker.on('exit', exited);
    worker.on('message', started);
  });
}

/** Asks each worker to close its handle, waits up to 2 s, then terminates it. */
async function stop(workers: readonly Worker[]) {
  // Idle workers are unreferenced; without this the process could exit before they close their handles.
  for (const worker of workers) worker.ref();
  await Promise.all(
    workers.map(
      (worker) =>
        new Promise<void>((done) => {
          const timer = setTimeout(done, 2000);
          worker.on('message', (message: FromWorker) => {
            if (message.type === 'closed') {
              clearTimeout(timer);
              done();
            }
          });
          worker.postMessage({ type: 'exit' } satisfies ToWorker);
        }),
    ),
  );
  await Promise.all(workers.map((worker) => worker.terminate()));
}

type Waiter = { resolve(partial: PartialAggregate): void; reject(error: unknown): void };

/**
 * Worker threads that answer partial aggregates. The first eligible aggregate starts them and runs in the calling
 * thread, as does every aggregate while they start, so a query never waits for them. They close after IDLE_MS
 * without a query. A worker that dies fails the tasks in flight, which then run in one thread, and the next aggregate
 * starts a fresh pool; a pool that fails to start is tried again after RETRY_MS. Idle workers are unreferenced, so
 * they never keep a process alive.
 */
export function createQueryPool(
  target: PoolTarget,
  settings: { workers: number; minRows: number },
): PartialRunner {
  let lanes: Worker[] | undefined;
  let starting: Promise<void> | undefined;
  let state: ParallelStats['state'] = 'idle';
  let error: string | undefined;
  let failedAt = 0;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let next = 1,
    lane = 0,
    active = 0,
    queries = 0,
    fallbacks = 0,
    starts = 0;
  const waiters = new Map<number, Waiter>();
  // close() may run while a start awaits its workers.
  const closed = () => state === 'closed';

  const retire = (workers: Worker[]) => {
    if (lanes !== workers) return;
    lanes = undefined;
    starting = undefined;
    if (state === 'ready') state = 'idle';
  };
  const start = () =>
    (starting ??= (async () => {
      state = 'starting';
      starts++;
      const spawned: Worker[] = [];
      try {
        for (let i = 0; i < settings.workers; i++) spawned.push(spawn(target));
        await Promise.all(spawned.map(ready));
      } catch (cause) {
        await Promise.allSettled(spawned.map((worker) => worker.terminate()));
        starting = undefined;
        if (!closed()) {
          state = 'failed';
          error = String((cause as Error)?.message ?? cause);
          failedAt = Date.now();
        }
        return;
      }
      if (closed()) {
        await Promise.allSettled(spawned.map((worker) => worker.terminate()));
        return;
      }
      for (const worker of spawned) {
        worker.on('message', (message: FromWorker) => {
          if (message.type !== 'partial' && message.type !== 'error') return;
          const waiter = waiters.get(message.id);
          if (!waiter) return;
          waiters.delete(message.id);
          if (message.type === 'partial') waiter.resolve(message.partial as PartialAggregate);
          else waiter.reject(Object.assign(new Error(message.message), { code: message.code }));
        });
        // Without a listener, a worker's uncaught error would be thrown in this thread; 'exit' follows and cleans up.
        worker.on('error', () => {});
        worker.on('exit', () => {
          if (lanes !== spawned) return;
          retire(spawned);
          for (const [id, waiter] of waiters) {
            waiters.delete(id);
            waiter.reject(new Error('A query worker exited.'));
          }
          void Promise.allSettled(spawned.map((other) => other.terminate()));
        });
        worker.unref();
      }
      lanes = spawned;
      state = 'ready';
      error = undefined;
    })());
  const armIdle = (workers: Worker[]) => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (active || lanes !== workers) return;
      retire(workers);
      void stop(workers);
    }, IDLE_MS);
    (idle as { unref?: () => void }).unref?.();
  };

  return {
    workers: settings.workers,
    minRows: settings.minRows,
    partials(task: PartialTask, signal?: Cancellation) {
      const workers = lanes;
      if (!workers) {
        if (state === 'idle' || (state === 'failed' && Date.now() - failedAt >= RETRY_MS))
          void start();
        return undefined;
      }
      if (signal?.aborted) return Promise.reject(signal.reason ?? new Error('Aborted'));
      clearTimeout(idle);
      const ids: [number, Worker][] = [];
      const parts = task.ranges.map((range) => {
        const id = next++,
          worker = workers[lane++ % workers.length]!;
        ids.push([id, worker]);
        return new Promise<PartialAggregate>((resolve, reject) => {
          waiters.set(id, { resolve, reject });
          worker.postMessage({
            type: 'partial',
            id,
            head: task.head,
            range,
            descriptor: task.descriptor,
            options: task.options,
          } satisfies ToWorker);
        });
      });
      const cancel = () => {
        for (const [id, worker] of ids) {
          const waiter = waiters.get(id);
          if (!waiter) continue;
          waiters.delete(id);
          worker.postMessage({ type: 'cancel', id } satisfies ToWorker);
          waiter.reject(signal?.reason ?? new Error('Aborted'));
        }
      };
      // DataView's signals are polled, not observed.
      const poll = signal && setInterval(() => signal.aborted && cancel(), 10);
      (poll as { unref?: () => void } | undefined)?.unref?.();
      if (active++ === 0) for (const worker of workers) worker.ref();
      return Promise.all(parts)
        .then(
          (partials) => {
            queries++;
            return partials;
          },
          (failure: unknown) => {
            // Stop the other parts; each worker's session holds its own pin on the snapshot.
            cancel();
            if (!signal?.aborted) fallbacks++;
            throw failure;
          },
        )
        .finally(() => {
          clearInterval(poll);
          if (--active === 0) {
            if (lanes === workers) for (const worker of workers) worker.unref();
            armIdle(workers);
          }
        });
    },
    stats: () => ({ state, ...settings, queries, fallbacks, starts, ...(error && { error }) }),
    async close() {
      state = 'closed';
      clearTimeout(idle);
      await starting;
      const workers = lanes;
      lanes = undefined;
      if (workers) await stop(workers);
    },
  };
}
