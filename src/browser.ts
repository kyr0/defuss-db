import { createOPFSStorage } from 'defuss-storage/opfs';
import type { OPFSStorageOptions } from 'defuss-storage/opfs';
import { createBrowserBackend } from 'defuss-dbsonl/browser';
import type { WebLockManager } from 'defuss-dbsonl/browser';
import { openDatabase } from './database.js';
import type { OpenOptions } from './types.js';
export interface BrowserOptions extends OpenOptions {
  namespace?: string;
  storage?: Omit<OPFSStorageOptions, 'name'>;
}
/** Run in a secure dedicated worker. Every tab/worker reaching these files uses this same namespace. */
export async function openOPFS(options: BrowserOptions = {}) {
  const { namespace = 'default', storage: storageOptions, ...database } = options;
  const capturedStorage = { ...storageOptions };
  const storage = await createOPFSStorage({ ...capturedStorage, name: namespace });
  const host = globalThis as unknown as { navigator: { locks: WebLockManager } };
  const chunk = Math.min(
    65536,
    capturedStorage.maxWriteBytes ?? 65536,
    capturedStorage.maxPendingWriteBytes ?? 65536,
  );
  return openDatabase(
    createBrowserBackend(storage, namespace, host.navigator.locks, chunk),
    database,
  );
}
export { createBrowserBackend };
