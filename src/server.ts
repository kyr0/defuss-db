import { createFileBackend } from 'defuss-dbsonl/server';
import type { FileBackendOptions } from 'defuss-dbsonl/server';
import { openWith } from './database.js';
import { createQueryPool, parallelSettings } from './query-pool.js';
import type { ParallelOptions } from './query-pool.js';
import type { OpenOptions } from './types.js';
export interface DirectoryOptions extends OpenOptions {
  /** Native file options plus dbsonl's scan pool (`scanWorkers`, `scanThreshold`) and `syncReadBytes`. */
  storage?: FileBackendOptions;
  /**
   * Worker threads that answer mergeable full-scan aggregates and counts together. On by default; false turns them off.
   * VERIFIED: tests/parallel.test.ts checks both, and that results equal one thread.
   */
  parallel?: boolean | ParallelOptions;
}
/** Native files, directory fsync and process-safe locking, shared by Node.js and Bun. */
export async function openDirectory(directory: string, options: DirectoryOptions = {}) {
  const { storage, parallel = true, ...database } = options;
  // Invalid settings fail before the store opens.
  const settings = parallel === false ? undefined : parallelSettings(parallel);
  return openWith(
    await createFileBackend(directory, storage),
    database,
    settings &&
      ((store) =>
        createQueryPool(
          { root: directory, name: store.name, storage: { ...storage }, store: store.options },
          settings,
        )),
  );
}
export { createFileBackend };
export type { ParallelOptions };
export type { ParallelStats } from './parallel.js';
