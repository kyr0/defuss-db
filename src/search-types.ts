import type { HistoryReadOptions } from './history-types.js';
import type { SearchOptions, SearchResult as LexicalHit } from 'defuss-lexicalsearch';
import type { HybridSearchOptions, HybridHit, SearchQuery } from 'defuss-search';
import type { Document, PrimaryKey, Selection } from './types.js';

export type SearchAnalyzer =
  | 'unicode'
  | 'code'
  | 'keyword'
  | 'folded-keyword'
  | 'whitespace'
  | 'accent-folded'
  | 'en'
  | 'de'
  | 'es'
  | 'fr'
  | 'it'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'ru'
  | 'tr'
  | 'id'
  | 'vi'
  | 'ar'
  | 'ur'
  | 'hi'
  | 'bn'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'th';
export interface TextIndexOptions {
  /** Alias -> source path. Aliases are the field names used by lexical query syntax. */
  fields: Readonly<
    Record<string, { path: string; weight?: number; b?: number; analyzer?: SearchAnalyzer }>
  >;
  analyzer?: SearchAnalyzer;
  k1?: number;
  ranking?: 'relevance' | 'exact-first';
  maxTokenLength?: number;
}
export interface VectorIndexOptions {
  path: string;
  dimensions: number;
  metric?: 'cosine' | 'dot';
  strategy?: 'exact' | 'turboquant';
  /** Exact rescore of at least this many approximate candidates; 0 disables. */
  refineCandidates?: number;
  seed?: number;
  clip?: number;
}
interface SearchIndexBase {
  name: string;
  /** Bounds the materialized search engine. Defaults: 100,000 documents; 64 MiB persisted inputs. */
  maxDocuments?: number;
  maxInputBytes?: number;
}
export type SearchIndexDefinition = SearchIndexBase &
  (
    | { kind: 'lexical'; text: TextIndexOptions; vector?: never }
    | { kind: 'vector'; vector: VectorIndexOptions; text?: never }
    | { kind: 'hybrid'; text: TextIndexOptions; vector: VectorIndexOptions }
  );
export interface SearchRequest extends HistoryReadOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  /** Typed primary keys; applied before retrieval top-k. */
  ids?: readonly PrimaryKey[];
  /** DataView filters / Boolean expression; evaluated before retrieval top-k on the same snapshot. */
  filter?: Selection;
  lexical?: Omit<SearchOptions, 'filter' | 'ids' | 'limit' | 'offset'>;
  hybrid?: Omit<HybridSearchOptions, 'ids' | 'signal' | 'limit' | 'offset' | 'rerank'>;
}
export interface DocumentSearchHit<T extends Document> {
  id: T['id'];
  score: number;
  rank: number;
  document: T;
  lexical?: Omit<LexicalHit, 'id' | 'metadata'>;
  hybrid?: Omit<HybridHit, 'id'>;
}
export interface DocumentSearchResult<T extends Document> {
  hits: DocumentSearchHit<T>[];
  revision: number;
  generation: string;
  kind: SearchIndexDefinition['kind'];
  /** Lexical: all matches; vector: eligible vectors; hybrid: finite retrieved candidate union. */
  totalCandidates: number;
  cacheHit: boolean;
  /** Candidate documents evaluated by the optional pre-retrieval DataView predicate. */
  filterScannedRows: number;
}
export type DocumentSearchQuery = string | SearchQuery;
