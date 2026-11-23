import { assertChange, checkCoverage, checkTemporalUnique, clock } from './history-store.js';
import type { TimeScope } from './history-types.js';
import { touchCollection } from './collection-version.js';
import { projectSearch, type SearchInput } from './search-config.js';
import { saveSchema, transactionSchema } from './schema-cache.js';
import { maintainSearch } from './search-mutations.js';
import { DatabaseError, ValidationError } from './errors.js';
import { validationSchema } from './catalog.js';
import { validateValue } from './validate.js';
import {
  documentKey,
  documentPrefix,
  indexKey,
  indexPrefix,
  normalizeIndex,
  primary,
  range,
} from './keys.js';
import type { Dbsonl } from 'defuss-dbsonl';
import type { Document, IndexDefinition, Writer } from './types.js';

export const CREATED_AT = '_createdAt';
export const UPDATED_AT = '_updatedAt';
type Stamps = { created?: unknown; updated?: unknown };
const fields = (doc: Document) => doc as unknown as Record<string, unknown>;
const stampsOf = (doc: Document): Stamps => ({
  created: fields(doc)[CREATED_AT],
  updated: fields(doc)[UPDATED_AT],
});
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
    // Every write of a timestamped collection changes _updatedAt, so its indexes are recomputed too.
    keys: schema.indexes.map((index) =>
      patch &&
      index.fields.every(
        (field) =>
          !field.includes('.') &&
          !Object.hasOwn(patch, field) &&
          !(schema.timestamps && field === UPDATED_AT),
      )
        ? null
        : indexKey(collection, index, row, token),
    ),
    search: schema.searchIndexes.map((index) => projectSearch(row, index)),
    stamps: stampsOf(row),
  };
}
type PreviousDocument = { keys: (string | null)[]; search: SearchInput[]; stamps: Stamps };
/**
 * How a write treats `_createdAt` and `_updatedAt` in a timestamped collection: `'write'` stamps the commit time and
 * accepts only the stored values from the caller; `'keep'` (archive import, restore) keeps valid Dates it carries.
 */
export type StampMode = 'write' | 'keep';
const sampled = new WeakMap<Writer, number>();
const validTime = (value: unknown) =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : undefined;
/** Both stamps are valid Dates and `_createdAt` is not after `_updatedAt`, the pair verify() accepts. */
const ordered = ({ created, updated }: Stamps) => {
  const c = validTime(created),
    u = validTime(updated);
  return c !== undefined && u !== undefined && c <= u;
};
/**
 * One time per transaction: the history clock in a tracked collection, so `_updatedAt` equals the version's `from`, and
 * otherwise one Date.now() sample. Untracked collections do not read the history clock key: every transaction would
 * then write that one key, and concurrent writers of different documents would conflict. A document's `_updatedAt`
 * never moves back, even when another process's clock was ahead.
 * VERIFIED: tests/timestamps.test.ts: concurrent writers do not conflict, `_updatedAt` equals the history `from`, and an
 * ahead-of-clock `_updatedAt` survives the next write.
 */
async function stamp(
  tx: Writer,
  tracked: boolean,
  row: Document,
  old: Stamps | undefined,
  mode: StampMode,
): Promise<void> {
  const created = fields(row)[CREATED_AT],
    updated = fields(row)[UPDATED_AT];
  if (mode === 'keep') {
    if (ordered({ created, updated })) return;
  } else
    for (const [field, value, stored] of [
      [CREATED_AT, created, old?.created],
      [UPDATED_AT, updated, old?.updated],
    ] as const)
      if (
        value !== undefined &&
        (validTime(value) === undefined || validTime(value) !== validTime(stored))
      )
        throw new DatabaseError(
          'INVALID_DOCUMENT',
          `${field} is maintained by defuss-db; omit it or pass the stored value.`,
        );
  let now = tracked ? (await clock(tx)).ms : sampled.get(tx);
  if (now === undefined) sampled.set(tx, (now = Date.now()));
  const at = Math.max(now, validTime(old?.updated) ?? -Infinity);
  const createdAt =
    (mode === 'keep' ? validTime(created) : undefined) ?? validTime(old?.created) ?? at;
  fields(row)[CREATED_AT] = new Date(createdAt);
  fields(row)[UPDATED_AT] = new Date(Math.max(at, createdAt));
}
export async function putDocument<T extends Document>(
  tx: Writer,
  collection: string,
  row: T,
  insertOnly = false,
  previous?: PreviousDocument,
  scope?: TimeScope,
  stamps: StampMode = 'write',
  // false for stored documents written back as they are: an archive import, the stamping of existing documents
  validate = true,
): Promise<void> {
  const token = primary(row.id),
    key = documentPrefix(collection) + token;
  const stored = await transactionSchema(tx, collection),
    schema = stored.schema;
  let current: { found: boolean; value?: unknown } | undefined;
  // Timestamps are set before the history assertion, which stores the stamped image.
  if (schema.timestamps) {
    if (scope)
      throw new DatabaseError(
        'HISTORY_READ_ONLY',
        'A timestamped collection takes current writes only; history(id) holds the effective dates.',
      );
    current = previous ? undefined : await tx.get(key);
    const before = previous
      ? previous.stamps
      : current?.found
        ? stampsOf(current.value as Document)
        : undefined;
    await stamp(tx, !!schema.history, row, before, stamps);
  }
  // After stamping, so a schema may declare `_createdAt` and `_updatedAt`. VERIFIED: tests/schema-validation.test.ts
  // sets an inferred schema with additionalProperties: false on a timestamped collection and inserts.
  const rules = validate ? await validationSchema(tx, collection) : undefined;
  if (rules) {
    const issues = validateValue(rules, row);
    if (issues.length) throw new ValidationError(collection, row.id, issues);
  }
  if (scope || schema.history) {
    checkCoverage(schema, scope?.time);
    const result = await assertChange(tx, collection, token, schema, row, scope, insertOnly);
    if (!result.live) return;
  }
  const old = current ?? (previous ? { found: true, value: undefined } : await tx.get(key));
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

/** Present while existing documents are being stamped: the next document key to visit. */
export const stampingKey = (collection: string) => 'c:' + collection;
/**
 * Turns timestamps on for a collection, then stamps its existing documents in batches, each one transaction: they get
 * the time of their batch, since their creation time is unknown, but keep a valid `_createdAt` Date and an ordered pair
 * they already hold. Writes between batches stamp themselves. The stored cursor lets a later call, in any process,
 * resume an interrupted pass; once it is gone, a call reads one key and returns. Rescanning instead would cost a full
 * read on every ensureCollection.
 * VERIFIED: tests/timestamps.test.ts stamps 300 documents, resumes after a failed batch, and restamps a reversed pair.
 */
export async function enableTimestamps(
  store: Dbsonl<unknown>,
  collection: string,
  enable: boolean,
  batch: number,
  signal?: AbortSignal,
): Promise<void> {
  const bounds = range(documentPrefix(collection));
  for (let conflicts = 0; ; ) {
    signal?.throwIfAborted();
    try {
      const done = (
        await store.transaction(
          async (tx) => {
            const { schema } = await transactionSchema(tx, collection);
            if (schema.timestamps && !enable)
              throw new DatabaseError('SCHEMA_MISMATCH', 'Timestamps are persistent.');
            if (!enable) return true;
            const cursor = await tx.get(stampingKey(collection));
            if (schema.timestamps && !cursor.found) return true;
            if (!schema.timestamps)
              await saveSchema(tx, collection, { ...schema, timestamps: true });
            // DBSONL scans take an inclusive lower bound; the key after `last` is `last` plus the smallest code unit.
            let scanned = 0,
              next = '';
            const from = cursor.found ? (cursor.value as string) : bounds.gte;
            for await (const row of tx.scan({ gte: from, lt: bounds.lt, limit: batch })) {
              scanned++;
              next = row.key + '\0';
              const doc = row.value as Document;
              if (!ordered(stampsOf(doc))) {
                const { [CREATED_AT]: _c, [UPDATED_AT]: _u, ...rest } = fields(doc);
                await putDocument(
                  tx,
                  collection,
                  rest as unknown as Document,
                  false,
                  undefined,
                  undefined,
                  'write',
                  false,
                );
              }
            }
            if (scanned < batch) tx.delete(stampingKey(collection));
            else tx.put(stampingKey(collection), next);
            return scanned < batch;
          },
          { signal },
        )
      ).result;
      if (done) return;
      conflicts = 0;
    } catch (error) {
      if ((error as { code?: string }).code !== 'CONFLICT' || ++conflicts > 16) throw error;
    }
  }
}
