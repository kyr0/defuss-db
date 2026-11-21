import { DatabaseError } from './errors.js';
import { documentPrefix, primary, range } from './keys.js';
import { saveSchema, transactionSchema } from './schema-cache.js';
import {
  equalInput,
  inputBytes,
  normalizeSearchIndex,
  projectSearch,
  readSearchState,
  searchPrefix,
  searchStateKey,
} from './search-config.js';
import type { SearchInput, SearchState } from './search-config.js';
import type { SearchIndexDefinition } from './search-types.js';
import type { Document, Schema, Writer } from './types.js';

const states = new WeakMap<Writer, Map<string, SearchState>>();
async function stateFor(tx: Writer, key: string): Promise<SearchState> {
  let cache = states.get(tx);
  if (!cache) states.set(tx, (cache = new Map()));
  let state = cache.get(key);
  if (!state) {
    state = readSearchState((await tx.get(key)).value);
    cache.set(key, state);
  }
  return state;
}
function saveState(tx: Writer, key: string, state: SearchState, def: SearchIndexDefinition): void {
  if (state.documents > def.maxDocuments! || state.bytes > def.maxInputBytes!)
    throw new RangeError(`Search index ${def.name} exceeds its document or input-byte capacity.`);
  const next = { ...state, generation: globalThis.crypto.randomUUID() };
  tx.put(key, next);
  let cache = states.get(tx);
  if (!cache) states.set(tx, (cache = new Map()));
  cache.set(key, next);
}
/** Derived inputs and generation publish in the same commit as the document. Unchanged fields do no I/O. */
export async function maintainSearch(
  tx: Writer,
  collection: string,
  schema: Schema,
  old: Document | undefined,
  row: Document | undefined,
  capturedPrevious?: readonly SearchInput[],
): Promise<void> {
  for (const [i, def] of schema.searchIndexes.entries()) {
    const previous = capturedPrevious
        ? capturedPrevious[i]
        : old
          ? projectSearch(old, def)
          : undefined,
      next = row ? projectSearch(row, def) : undefined;
    if (previous && next && equalInput(previous, next)) continue;
    const key = searchPrefix(collection, def.name) + primary((row ?? old)!.id),
      stateKey = searchStateKey(collection, def.name);
    const state = await stateFor(tx, stateKey);
    const count = state.documents + Number(!!next) - Number(!!previous);
    const bytes =
      state.bytes + (next ? inputBytes(next) : 0) - (previous ? inputBytes(previous) : 0);
    if (next) tx.put(key, next);
    else tx.delete(key);
    saveState(tx, stateKey, { generation: state.generation, documents: count, bytes }, def);
  }
}
export async function createSearchIndex(
  tx: Writer,
  collection: string,
  input: SearchIndexDefinition,
): Promise<void> {
  const def = normalizeSearchIndex(input),
    schema = (await transactionSchema(tx, collection)).schema;
  const old = schema.searchIndexes.find((item) => item.name === def.name);
  if (old) {
    if (JSON.stringify(old) !== JSON.stringify(def))
      throw new DatabaseError('SCHEMA_MISMATCH', 'Search index exists with another definition.');
    return;
  }
  if (schema.searchIndexes.length >= 16)
    throw new RangeError('A collection supports at most 16 search indexes.');
  let documents = 0,
    bytes = 0;
  for await (const row of tx.scan(range(documentPrefix(collection)))) {
    const doc = row.value as Document,
      projected = projectSearch(doc, def);
    documents++;
    bytes += inputBytes(projected);
    if (documents > def.maxDocuments! || bytes > def.maxInputBytes!)
      throw new RangeError('Search index capacity exceeded.');
    tx.put(searchPrefix(collection, def.name) + primary(doc.id), projected);
  }
  saveState(tx, searchStateKey(collection, def.name), { generation: '', documents, bytes }, def);
  await saveSchema(tx, collection, { ...schema, searchIndexes: [...schema.searchIndexes, def] });
}
export async function dropSearchIndex(
  tx: Writer,
  collection: string,
  indexName: string,
): Promise<boolean> {
  const schema = (await transactionSchema(tx, collection)).schema;
  if (!schema.searchIndexes.some((item) => item.name === indexName)) return false;
  for await (const row of tx.scan(range(searchPrefix(collection, indexName)))) tx.delete(row.key);
  const key = searchStateKey(collection, indexName);
  tx.delete(key);
  states.get(tx)?.delete(key);
  await saveSchema(tx, collection, {
    ...schema,
    searchIndexes: schema.searchIndexes.filter((item) => item.name !== indexName),
  });
  return true;
}
/** Audit payload comparison deliberately uses the same projection as writes. */
export function assertSearchInput(value: unknown, expected: SearchInput): void {
  if (!value || !equalInput(value as SearchInput, expected))
    throw new DatabaseError('CORRUPT', 'Stale search index input.');
}
