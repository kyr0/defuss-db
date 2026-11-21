import type { Dbsonl } from 'defuss-dbsonl';
import { DatabaseError } from './errors.js';
import { FORMAT_KEY } from './keys.js';

type Marker = { format: 'defuss-db'; version: number; id?: string };
/**
 * The one store layout this build reads and writes. Development builds wrote markers 1 to 4 with other layouts
 * (for example, a stored schema for every collection); rejecting them fails closed instead of misreading them.
 * VERIFIED: tests/search.test.ts opens stores with markers 1 to 4 and expects SCHEMA_MISMATCH.
 */
export const FORMAT_VERSION = 5;

export function storeIdentity(value: unknown): string {
  const marker = value as Marker | undefined;
  if (
    marker?.format !== 'defuss-db' ||
    marker.version !== FORMAT_VERSION ||
    typeof marker.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(marker.id)
  )
    throw new DatabaseError(
      'SCHEMA_MISMATCH',
      'Unsupported database format. Export the data with the build that wrote it.',
    );
  return marker.id;
}

/** Publish the persistent identity on an empty store; validate it on every other open. */
export async function ensureFormat(store: Dbsonl<unknown>): Promise<string> {
  const first = await store.get(FORMAT_KEY);
  if (first.found) return storeIdentity(first.value);
  try {
    const { result } = await store.transaction(async (tx) => {
      const current = await tx.get(FORMAT_KEY);
      if (current.found) return storeIdentity(current.value);
      for await (const _ of tx.scan({ limit: 1 }))
        throw new DatabaseError('SCHEMA_MISMATCH', 'Nonempty store has no defuss-db marker.');
      const id = globalThis.crypto.randomUUID();
      tx.put(FORMAT_KEY, { format: 'defuss-db', version: FORMAT_VERSION, id });
      return id;
    });
    return result;
  } catch (error) {
    if ((error as { code?: string })?.code !== 'CONFLICT') throw error;
    // Two openers may both find an empty store. Use the winning committed identity.
    const winner = await store.get(FORMAT_KEY);
    if (!winner.found) throw error;
    return storeIdentity(winner.value);
  }
}
