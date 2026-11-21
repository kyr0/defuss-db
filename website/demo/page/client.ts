// The page's side of the worker protocol (shared/protocol.ts): one promise per call, progress events to a listener.
import type { Call, Op, Ops, Progress, Reply } from '../shared/protocol.js';

export class WorkerError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface Client {
  call<K extends Op>(op: K, args: Ops[K]['args']): Promise<Ops[K]['result']>;
}

export function createClient(url: URL, onProgress: (event: Progress) => void): Client {
  const worker = new Worker(url, { type: 'module' });
  const waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  let next = 0;
  worker.addEventListener('message', ({ data }: MessageEvent<Reply | Progress>) => {
    if ('type' in data) return onProgress(data);
    const pending = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.ok) pending?.resolve(data.value);
    else pending?.reject(new WorkerError(data.error, data.code));
  });
  // A worker that fails to load or throws at the top level answers nothing; fail every call instead of hanging.
  worker.addEventListener('error', (event) => {
    for (const pending of waiting.values())
      pending.reject(new WorkerError(event.message || 'The database worker failed.'));
    waiting.clear();
  });
  return {
    call<K extends Op>(op: K, args: Ops[K]['args']) {
      const id = ++next;
      return new Promise<Ops[K]['result']>((resolve, reject) => {
        waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
        worker.postMessage({ id, op, args } satisfies Call<K>);
      });
    },
  };
}

export const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
