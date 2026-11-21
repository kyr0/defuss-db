import { DatabaseError } from './errors.js';
import { stageSchemaEvent } from './history-store.js';
import { touchCollection } from './collection-version.js';
import { readSchema, schemaKey } from './keys.js';
import type { Schema, Writer } from './types.js';

// A Writer exists for exactly one transaction: its first schema read stays in the conflict read set.
const schemas = new WeakMap<Writer, Map<string, { found: boolean; schema: Schema }>>();
export async function transactionSchema(tx: Writer, collection: string) {
  let cache = schemas.get(tx);
  if (!cache) schemas.set(tx, (cache = new Map()));
  let entry = cache.get(collection);
  if (!entry) {
    const stored = await tx.get(schemaKey(collection));
    entry = { found: stored.found, schema: readSchema(stored.value) };
    cache.set(collection, entry);
  }
  if (entry.schema.activating)
    throw new DatabaseError(
      'HISTORY_ACTIVATING',
      'Collection writes resume when ensureCollection finishes its baseline.',
    );
  return entry;
}
export async function saveSchema(
  tx: Writer,
  collection: string,
  schema: Schema,
  record = true,
): Promise<void> {
  if (record && schema.history) await stageSchemaEvent(tx, collection, schema);
  tx.put(schemaKey(collection), schema);
  touchCollection(tx, collection);
  schemas.get(tx)?.set(collection, { found: true, schema });
}
