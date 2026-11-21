import { assertChange, checkCoverage, checkTemporalUnique } from './history-store.js';
import type { TimeScope } from './history-types.js';
import { touchCollection } from './collection-version.js';
import { projectSearch, type SearchInput } from './search-config.js';
import { saveSchema, transactionSchema } from './schema-cache.js';
import { maintainSearch } from './search-mutations.js';
import { DatabaseError } from './errors.js';
import {
  documentKey,
  documentPrefix,
  indexKey,
  indexPrefix,
  normalizeIndex,
  primary,
  range,
} from './keys.js';
import type { Document, IndexDefinition, Writer } from './types.js';

/** Capture only derived keys/inputs before an updater can mutate its decoded document. */
export async function previousDocument(
  tx: Writer,
  collection: string,
  row: Document,
  patch?: object,
) {
  const schema = (await transactionSchema(tx, collection)).schema;
  const token = primary(row.id);
  return {
    // A shallow patch cannot mutate an untouched direct leaf. Dotted paths may revisit the root
    // through a cycle, and updater callbacks may mutate any nested value. Recompute those keys.
    keys: schema.indexes.map((index) =>
      patch && index.fields.every((field) => !field.includes('.') && !Object.hasOwn(patch, field))
        ? null
        : indexKey(collection, index, row, token),
    ),
    search: schema.searchIndexes.map((index) => projectSearch(row, index)),
  };
}
type PreviousDocument = { keys: (string | null)[]; search: SearchInput[] };
export async function putDocument<T extends Document>(
  tx: Writer,
  collection: string,
  row: T,
  insertOnly = false,
  previous?: PreviousDocument,
  scope?: TimeScope,
): Promise<void> {
  const token = primary(row.id),
    key = documentPrefix(collection) + token;
  const stored = await transactionSchema(tx, collection),
    schema = stored.schema;
  if (scope || schema.history) {
    checkCoverage(schema, scope?.time);
    const result = await assertChange(tx, collection, token, schema, row, scope, insertOnly);
    if (!result.live) return;
  }
  const old = previous ? { found: true, value: undefined } : await tx.get(key);
  if (old.found && insertOnly && !scope)
    throw new DatabaseError('DUPLICATE_KEY', `Duplicate primary key in ${collection}.`);
  const changes: { key: string; previous?: string }[] = [];
  for (let i = 0; i < schema.indexes.length; i++) {
    const index = schema.indexes[i]!;
    const prior = previous
      ? previous.keys[i]
      : old.found
        ? indexKey(collection, index, old.value as Document, token)
        : undefined;
    if (prior === null) continue;
    const next = indexKey(collection, index, row, token);
    if (next === prior) continue;
    // All uniqueness claims are checked before staging mutations. Absent-owner reads participate in conflict checking.
    if (index.unique) {
      const owner = await tx.get(next);
      if (owner.found && owner.value !== token)
        throw new DatabaseError(
          'DUPLICATE_KEY',
          `Unique index ${index.name} already has this value.`,
        );
    }
    changes.push({ key: next, previous: prior });
  }
  for (const item of changes) {
    if (item.previous) tx.delete(item.previous);
    tx.put(item.key, token);
  }
  await maintainSearch(
    tx,
    collection,
    schema,
    old.found ? (old.value as Document) : undefined,
    row,
    previous?.search,
  );
  tx.put(key, row);
  // The default schema stays implicit: the r: marker records the collection, so concurrent first writes to a new
  // collection share no schema read-modify-write and do not conflict. Only DDL stores a schema. VERIFIED: four
  // concurrent puts into a new collection returned three CONFLICT errors while this function wrote the schema.
  touchCollection(tx, collection);
}
export async function deleteDocument(
  tx: Writer,
  collection: string,
  id: Document['id'],
  scope?: TimeScope,
): Promise<boolean> {
  const schema = (await transactionSchema(tx, collection)).schema;
  if (scope) {
    checkCoverage(schema, scope.time);
    const result = await assertChange(tx, collection, primary(id), schema, null, scope);
    if (!result.applied || !result.live) return result.applied;
  }
  const key = documentKey(collection, id),
    old = await tx.get(key);
  if (!old.found) return false;
  if (schema.history && !scope) await assertChange(tx, collection, primary(id), schema, null);
  for (const index of schema.indexes) tx.delete(indexKey(collection, index, old.value as Document));
  await maintainSearch(tx, collection, schema, old.value as Document, undefined);
  tx.delete(key);
  touchCollection(tx, collection);
  return true;
}
export async function createIndex(
  tx: Writer,
  collection: string,
  input: IndexDefinition,
): Promise<void> {
  const index = normalizeIndex(input),
    schema = (await transactionSchema(tx, collection)).schema;
  const old = schema.indexes.find((item) => item.name === index.name);
  if (old) {
    if (JSON.stringify(old) !== JSON.stringify(index))
      throw new DatabaseError(
        'SCHEMA_MISMATCH',
        `Index ${index.name} exists with another definition.`,
      );
    return;
  }
  if (schema.indexes.length >= 64)
    throw new RangeError('A collection supports at most 64 secondary indexes.');
  if (index.temporalUnique) {
    checkCoverage(schema);
    await checkTemporalUnique(tx, collection, index);
  }
  // The schema read and range scan participate in serializable validation; a competing writer cannot escape the build.
  for await (const row of tx.scan(range(documentPrefix(collection)))) {
    const doc = row.value as Document,
      token = primary(doc.id),
      key = indexKey(collection, index, doc, token);
    if (index.unique) {
      const owner = await tx.get(key);
      if (owner.found && owner.value !== token)
        throw new DatabaseError(
          'DUPLICATE_KEY',
          `Existing documents violate unique index ${index.name}.`,
        );
    }
    tx.put(key, token);
  }
  await saveSchema(tx, collection, { ...schema, indexes: [...schema.indexes, index] });
}
export async function dropIndex(
  tx: Writer,
  collection: string,
  indexName: string,
): Promise<boolean> {
  const schema = (await transactionSchema(tx, collection)).schema;
  const index = schema.indexes.find((item) => item.name === indexName);
  if (!index) return false;
  for await (const row of tx.scan(range(indexPrefix(collection, index)))) tx.delete(row.key);
  await saveSchema(tx, collection, {
    ...schema,
    indexes: schema.indexes.filter((item) => item !== index),
  });
  return true;
}
