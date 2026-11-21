import { HybridSearch } from 'defuss-search';
import { createLexicalRetriever } from 'defuss-search/lexical';
import { createVectorRetriever } from 'defuss-search/vector';
import type { Retriever, RankedHit, HybridHit } from 'defuss-search';
import type { LexicalSearch, SearchResult as LexicalHit } from 'defuss-lexicalsearch';
import { forRows } from 'defuss-dataview/compute';
import { DatabaseError } from './errors.js';
import { documentPrefix, name, primary, range, readSchema, schemaKey } from './keys.js';
import type { Row } from 'defuss-dbsonl';
import {
  inputBytes,
  integer,
  lexicalEngine,
  readSearchState,
  searchPrefix,
  searchStateKey,
  searchVector,
} from './search-config.js';
import type { SearchInput } from './search-config.js';
import { capturedSelection, createDocumentSource } from './source.js';
import { readKeys } from './reads.js';
import type { Document, Reader, ReadContext } from './types.js';
import type {
  DocumentSearchQuery,
  DocumentSearchResult,
  SearchIndexDefinition,
  SearchRequest,
} from './search-types.js';

interface Engine {
  lexical?: LexicalSearch;
  vector?: Retriever;
  vectorIds: string[];
  bytes: number;
}
/** At most four immutable generations / 128 MiB estimated inputs, owned by one database handle. */
export class SearchCache {
  private entries = new Map<string, Engine>();
  get(key: string): Engine | undefined {
    const engine = this.entries.get(key);
    if (engine) {
      this.entries.delete(key);
      this.entries.set(key, engine);
    }
    return engine;
  }
  put(key: string, engine: Engine): void {
    if (engine.bytes > 128 * 1024 * 1024) return;
    this.entries.set(key, engine);
    while (
      this.entries.size > 4 ||
      [...this.entries.values()].reduce((sum, item) => sum + item.bytes, 0) > 128 * 1024 * 1024
    )
      this.entries.delete(this.entries.keys().next().value!);
  }
  clear(): void {
    this.entries.clear();
  }
}
async function buildEngine(
  reader: Reader,
  collection: string,
  def: SearchIndexDefinition,
  signal?: AbortSignal,
): Promise<Engine> {
  const lexical = def.text ? lexicalEngine(def) : undefined;
  const ids: string[] = [],
    vectors: Float32Array[] = [];
  let bytes = 0,
    count = 0;
  const prefix = searchPrefix(collection, def.name);
  const consume = (batch: readonly Row<unknown>[]) => {
    const documents: { id: string; fields: Record<string, string> }[] = [];
    for (const row of batch) {
      const input = row.value as SearchInput,
        id = row.key.slice(prefix.length);
      bytes += inputBytes(input);
      if (++count > def.maxDocuments! || bytes > def.maxInputBytes!)
        throw new DatabaseError('CORRUPT', 'Search index exceeds capacity.');
      if (lexical) documents.push({ id, fields: input.fields! });
      if (input.vector) {
        ids.push(id);
        vectors.push(input.vector);
      }
    }
    // One upstream validation/admission boundary per bounded batch, instead of per document.
    if (lexical) lexical.addAll(documents);
  };
  if (reader.scanBatches) {
    for await (const batch of reader.scanBatches({
      ...range(prefix),
      signal,
      batchSize: 128,
      // VERIFIED: without sizeOf, defuss-dbsonl 0.7.0 may scan in its worker pool; consume() counts input bytes.
      maxBatchBytes: Number.MAX_SAFE_INTEGER,
    }))
      consume(batch);
  } else {
    // Transaction overlays expose row scans. Keep the same ordering and bounded batch construction.
    let batch: Row<unknown>[] = [],
      batchBytes = 0;
    for await (const row of reader.scan({ ...range(prefix), signal })) {
      const size = inputBytes(row.value as SearchInput);
      if (batch.length && (batch.length === 128 || batchBytes + size > 1024 * 1024)) {
        consume(batch);
        batch = [];
        batchBytes = 0;
      }
      batch.push(row);
      batchBytes += size;
    }
    if (batch.length) consume(batch);
  }
  return {
    lexical,
    vectorIds: ids,
    bytes,
    vector: def.vector ? createVectorRetriever({ ...def.vector, ids, vectors }) : undefined,
  };
}
/** All filtering, scoring and hit hydration use one pinned storage revision, including transaction overlays. */
export async function searchDocuments<T extends Document>(
  context: ReadContext,
  collection: string,
  indexName: string,
  query: DocumentSearchQuery,
  options: SearchRequest = {},
): Promise<DocumentSearchResult<T>> {
  name(indexName);
  const limit = integer(options.limit ?? 10, 'limit', 0, 10_000),
    offset = integer(options.offset ?? 0, 'offset', 0, 10_000);
  integer(offset + limit, 'offset + limit', 0, 10_000);
  if (options.ids !== undefined && (!Array.isArray(options.ids) || options.ids.length > 100_000))
    throw new RangeError('ids accepts at most 100,000 typed primary keys.');
  const raw = typeof query === 'string' ? { text: query } : query;
  if (!raw || typeof raw.text !== 'string' || raw.text.length > 16_384)
    throw new TypeError('Search text must be at most 16,384 UTF-16 units.');
  if (raw.vector !== undefined) integer(raw.vector.length, 'query vector dimensions', 1, 65_536);
  const signal = options.signal;
  // Capture user-owned arrays and option records before the first await. Functions are not persisted or accepted.
  const input =
    typeof query === 'string'
      ? { text: query }
      : {
          text: query.text,
          language: query.language,
          vector: query.vector === undefined ? undefined : Array.from(query.vector),
        };
  const lexicalOptions = options.lexical ? structuredClone(options.lexical) : {};
  const hybridOptions = options.hybrid ? structuredClone(options.hybrid) : {};
  let allowed = options.ids ? new Set(options.ids.map(primary)) : undefined;
  const q = forRows<Document>();
  // Capture the DataView predicate and the planner inputs before the first await. Explicit short ID lists
  // can be point-read under the same snapshot. BM25 still uses the complete persisted corpus.
  const { access, ...predicate } = options.filter ?? {};
  const selection = capturedSelection({ ...predicate, access });
  if (options.filter && options.ids && options.ids.length <= 256)
    selection.filters = [
      ...(selection.filters ?? []),
      { field: 'id', op: 'in', value: [...options.ids] },
    ];
  const filterPlan = options.filter
    ? q.rows({ ...predicate, select: { id: q.field('id') } })
    : undefined;
  let filterScannedRows = 0;
  const abort = () => {
    if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
  };
  abort();
  context.check();
  const lease = await context.open();
  try {
    const schema = readSchema((await lease.reader.get(schemaKey(collection))).value);
    const def = schema.searchIndexes.find((index) => index.name === indexName);
    if (!def)
      throw new DatabaseError('SCHEMA_MISMATCH', `Search index ${indexName} does not exist.`);
    const generation =
      (await lease.reader.searchGeneration?.()) ??
      readSearchState((await lease.reader.get(searchStateKey(collection, indexName))).value)
        .generation;
    if (def.vector) {
      if (!input.vector) throw new TypeError('Vector and hybrid queries require query.vector.');
      input.vector = Array.from(searchVector(input.vector, def.vector));
    }
    if (typeof input.text !== 'string') throw new TypeError('Search text must be a string.');
    if (filterPlan) {
      const source = createDocumentSource<Document>(
        {
          check: () => context.check(),
          get: (key) => lease.reader.get(key),
          open: async () => ({ reader: lease.reader, close: async () => {} }),
          lookupConcurrency: context.lookupConcurrency,
        },
        collection,
        selection,
      );
      const result = await filterPlan.evaluate(source, undefined, {
        signal,
        maxScannedRows: def.maxDocuments,
        maxOutputRows: def.maxDocuments,
      });
      filterScannedRows = result.summary.scannedRows;
      const matching = new Set(result.rows.map((row) => primary(row.id)));
      allowed = allowed ? new Set([...allowed].filter((id) => matching.has(id))) : matching;
    }
    abort();
    const cacheKey = `${collection}:${indexName}:${generation}`;
    let engine = context.searchCache?.get(cacheKey);
    const cacheHit = !!engine;
    if (!engine) {
      engine = await buildEngine(lease.reader, collection, def, signal);
      context.searchCache?.put(cacheKey, engine);
    }
    abort();
    let hits: readonly RankedHit[], totalCandidates: number;
    let lexicalHits: LexicalHit[] | undefined, hybridHits: HybridHit[] | undefined;
    if (def.kind === 'lexical') {
      const result = engine.lexical!.searchWithStats(input.text, {
        ...lexicalOptions,
        language: input.language ?? lexicalOptions.language,
        ids: allowed,
        limit,
        offset,
      });
      hits = lexicalHits = result.hits;
      totalCandidates = result.total;
    } else if (def.kind === 'vector') {
      hits = (
        await engine.vector!.retrieve(input, {
          ids: allowed,
          limit: limit ? offset + limit : 0,
          signal,
        })
      ).slice(offset);
      totalCandidates = allowed
        ? engine.vectorIds.filter((id) => allowed!.has(id)).length
        : engine.vectorIds.length;
    } else {
      const hybrid = new HybridSearch({
        lexical: createLexicalRetriever(engine.lexical!, {
          search: lexicalOptions,
          exact: {
            fields: Object.keys(def.text.fields),
            caseSensitive: lexicalOptions.caseSensitive ?? true,
          },
        }),
        vector: engine.vector!,
      });
      const result = await hybrid.searchWithStats(input, {
        ...hybridOptions,
        limit,
        offset,
        ids: allowed,
        signal,
        rerank: false,
      });
      hits = hybridHits = result.hits;
      totalCandidates = result.totalCandidates;
    }
    const documents = await readKeys(
      lease.reader,
      hits.map((hit) => documentPrefix(collection) + hit.id),
      signal,
    );
    abort();
    return {
      kind: def.kind,
      revision: lease.reader.revision,
      generation,
      totalCandidates,
      filterScannedRows,
      cacheHit,
      hits: hits.map((hit, i) => {
        const doc = documents[i];
        if (!doc?.found || primary((doc.value as T).id) !== hit.id)
          throw new DatabaseError('CORRUPT', 'Search hit points to a missing document.');
        const { id: _lexId, metadata: _meta, ...lexical } = lexicalHits?.[i] ?? {};
        const { id: _hybridId, ...hybrid } = hybridHits?.[i] ?? {};
        return {
          id: (doc.value as T).id,
          score: hit.score,
          rank: offset + i + 1,
          document: doc.value as T,
          ...(lexicalHits ? { lexical } : {}),
          ...(hybridHits ? { hybrid } : {}),
        };
      }),
    } as DocumentSearchResult<T>;
  } finally {
    await lease.close();
  }
}
