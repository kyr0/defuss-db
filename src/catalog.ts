/**
 * `_collections`, the catalog of a database: one document per collection, `{ id: <collection>, schema? }`, where
 * `schema` is the JSON Schema that writes to the collection validate against. An entry exists once ensureCollection()
 * or setSchema() ran for the collection; nothing else writes it, and analyzeSchema() never does.
 *
 * Why documents of a collection and not a field of the stored index schema (`s:`): the catalog is read like any
 * collection (find, query, a snapshot, the Explorer) and can take further fields per collection later. Its name is
 * no valid collection name, so no existing collection can hold it, and the API hands it out as a read-only view.
 *
 * Why a marker beside the entry (`m:<collection>`, present while a schema is set): every write has to learn whether
 * its collection has a schema, and that read joins the transaction's conflict set, so a write that saw no schema
 * cannot commit after one was set. Reading the entry itself would also make a writer conflict with the first
 * ensureCollection() of its collection, which creates the entry; only setSchema() writes the marker.
 * VERIFIED: tests/schema-validation.test.ts (a late write conflicts with setSchema) and tests/database.test.ts
 * (ensureCollection concurrent with a first write commits all three).
 */
import type { Dbsonl } from 'defuss-dbsonl';
import { touchCollection } from './collection-version.js';
import { DatabaseError } from './errors.js';
import type { JsonSchema } from './json-schema.js';
import { documentKey, name } from './keys.js';
import type { Document, Writer } from './types.js';
import { checkSchema } from './validate.js';

export const COLLECTIONS = '_collections';
/** A document of `_collections`. */
export interface CollectionEntry extends Document {
  /** The collection's name. */
  id: string;
  /** The JSON Schema set with setSchema(). */
  schema?: JsonSchema;
}
export const entryKey = (collection: string): string => documentKey(COLLECTIONS, collection);
export const validatedKey = (collection: string): string => 'm:' + collection;
/** A collection name to read: a user collection or the catalog. */
export function readable(collection: string): string {
  return collection === COLLECTIONS ? collection : name(collection);
}
/** A stored or imported entry, or CORRUPT. */
export function readEntry(value: unknown): CollectionEntry {
  try {
    const entry = value as CollectionEntry;
    name(entry.id);
    if (entry.schema !== undefined) checkSchema(entry.schema);
    return entry;
  } catch (error) {
    throw new DatabaseError('CORRUPT', 'Invalid collection entry.', { cause: error });
  }
}

// A Writer exists for exactly one transaction: its first marker read stays in the conflict read set.
const schemas = new WeakMap<Writer, Map<string, JsonSchema | undefined>>();
function remember(tx: Writer, collection: string, schema: JsonSchema | undefined): void {
  let cache = schemas.get(tx);
  if (!cache) schemas.set(tx, (cache = new Map()));
  cache.set(collection, schema);
}
/** The schema this transaction's writes to `collection` validate against. */
export async function validationSchema(
  tx: Writer,
  collection: string,
): Promise<JsonSchema | undefined> {
  const cache = schemas.get(tx);
  if (cache?.has(collection)) return cache.get(collection);
  const schema = (await tx.get(validatedKey(collection))).found
    ? ((await tx.get(entryKey(collection))).value as CollectionEntry | undefined)?.schema
    : undefined;
  remember(tx, collection, schema);
  return schema;
}
/** Stores an entry with its marker; the collection exists from then on. */
export function saveEntry(tx: Writer, entry: CollectionEntry, hadSchema: boolean): void {
  tx.put(entryKey(entry.id), entry);
  if (entry.schema !== undefined) tx.put(validatedKey(entry.id), 1);
  else if (hadSchema) tx.delete(validatedKey(entry.id));
  touchCollection(tx, COLLECTIONS);
  touchCollection(tx, entry.id);
  remember(tx, entry.id, entry.schema);
}
/** Sets (a schema that passed checkSchema) or removes (null) the schema of a collection. */
export async function setSchema(
  tx: Writer,
  collection: string,
  schema: JsonSchema | null,
): Promise<void> {
  const stored = await tx.get(entryKey(collection));
  const { schema: old, ...rest } = stored.found
    ? (stored.value as CollectionEntry)
    : { id: collection };
  saveEntry(tx, schema ? { ...rest, schema } : rest, old !== undefined);
}
/** The entry of an archive: a target that set another schema keeps it (`skip`), takes this one (`replace`) or refuses. */
export async function importEntry(
  tx: Writer,
  collection: string,
  fields: unknown,
  conflicts?: 'error' | 'replace' | 'skip',
): Promise<void> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields))
    throw new DatabaseError('CORRUPT', 'Invalid collection entry.');
  const entry = readEntry({ ...fields, id: collection });
  const stored = await tx.get(entryKey(collection));
  const current = stored.found ? (stored.value as CollectionEntry) : undefined;
  if (current) {
    // An existing entry gains a schema, and loses or changes one only on request.
    if (entry.schema === undefined) return;
    if (current.schema !== undefined) {
      if (JSON.stringify(current.schema) === JSON.stringify(entry.schema) || conflicts === 'skip')
        return;
      if (conflicts !== 'replace')
        throw new DatabaseError(
          'SCHEMA_MISMATCH',
          `Collection ${collection} has another JSON Schema.`,
        );
    }
  }
  saveEntry(tx, { ...current, ...entry }, current?.schema !== undefined);
}
/** ensureCollection(): the entry of a collection, created once. */
export async function ensureEntry(
  store: Dbsonl<unknown>,
  collection: string,
  signal?: AbortSignal,
): Promise<void> {
  const key = entryKey(collection);
  if ((await store.get(key)).found) return;
  try {
    await store.transaction(
      async (tx) => {
        if ((await tx.get(key)).found) return;
        tx.put(key, { id: collection });
        touchCollection(tx, COLLECTIONS);
      },
      { signal },
    );
  } catch (error) {
    // Two callers may both find no entry; the one that committed created it.
    if ((error as { code?: string }).code !== 'CONFLICT' || !(await store.get(key)).found)
      throw error;
  }
}
