import { en } from 'defuss-lexicalsearch/en';
import { de } from 'defuss-lexicalsearch/de';
import { es } from 'defuss-lexicalsearch/es';
import { fr } from 'defuss-lexicalsearch/fr';
import { it } from 'defuss-lexicalsearch/it';
import { pt } from 'defuss-lexicalsearch/pt';
import { nl } from 'defuss-lexicalsearch/nl';
import { pl } from 'defuss-lexicalsearch/pl';
import { ru } from 'defuss-lexicalsearch/ru';
import { tr } from 'defuss-lexicalsearch/tr';
import { id } from 'defuss-lexicalsearch/id';
import { vi } from 'defuss-lexicalsearch/vi';
import { ar } from 'defuss-lexicalsearch/ar';
import { ur } from 'defuss-lexicalsearch/ur';
import { hi } from 'defuss-lexicalsearch/hi';
import { bn } from 'defuss-lexicalsearch/bn';
import { ja } from 'defuss-lexicalsearch/ja';
import { zh } from 'defuss-lexicalsearch/zh';
import { ko } from 'defuss-lexicalsearch/ko';
import { th } from 'defuss-lexicalsearch/th';
import {
  LexicalSearch,
  unicodeAnalyzer,
  codeAnalyzer,
  keywordAnalyzer,
  foldedKeywordAnalyzer,
  whitespaceAnalyzer,
  accentFoldedAnalyzer,
} from 'defuss-lexicalsearch';
import { compileQuery } from 'defuss-dataview/query';
import { getPath } from './paths.js';
import { DatabaseError } from './errors.js';
import type { Document } from './types.js';
import type { SearchIndexDefinition, SearchAnalyzer, VectorIndexOptions } from './search-types.js';

const analyzers = {
  en,
  de,
  es,
  fr,
  it,
  pt,
  nl,
  pl,
  ru,
  tr,
  id,
  vi,
  ar,
  ur,
  hi,
  bn,
  ja,
  zh,
  ko,
  th,
  unicode: unicodeAnalyzer,
  code: codeAnalyzer,
  keyword: keywordAnalyzer,
  'folded-keyword': foldedKeywordAnalyzer,
  whitespace: whitespaceAnalyzer,
  'accent-folded': accentFoldedAnalyzer,
};
function analyzer(key: SearchAnalyzer = 'unicode') {
  if (!Object.hasOwn(analyzers, key)) throw new TypeError('Unknown search analyzer.');
  return analyzers[key];
}
export function lexicalEngine(def: SearchIndexDefinition): LexicalSearch {
  return new LexicalSearch({
    ...def.text,
    analyzer: analyzer(def.text?.analyzer),
    maxDocuments: def.maxDocuments,
    fields: Object.fromEntries(
      Object.entries(def.text!.fields).map(([key, field]) => [
        key,
        {
          weight: field.weight,
          b: field.b,
          analyzer: analyzer(field.analyzer ?? def.text?.analyzer),
        },
      ]),
    ),
  });
}
export function integer(
  value: number,
  label: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`${label} must be an integer in [${min}, ${max}].`);
  return value;
}
export function normalizeSearchIndex(input: SearchIndexDefinition): SearchIndexDefinition {
  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.name !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(input.name)
  )
    throw new TypeError('Invalid search index name.');
  if (!['lexical', 'vector', 'hybrid'].includes(input.kind))
    throw new TypeError('Invalid search index kind.');
  const output = {
    name: input.name,
    kind: input.kind,
    maxDocuments: integer(input.maxDocuments ?? 100_000, 'maxDocuments', 1),
    maxInputBytes: integer(input.maxInputBytes ?? 64 * 1024 * 1024, 'maxInputBytes', 1),
  } as SearchIndexDefinition;
  if (input.kind !== 'vector') {
    if (!input.text || !input.text.fields || typeof input.text.fields !== 'object')
      throw new TypeError('Text fields are required.');
    const fields = Object.entries(input.text.fields).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    if (!fields.length || fields.length > 32) throw new RangeError('Use 1 to 32 text fields.');
    output.text = {
      analyzer: input.text.analyzer ?? 'unicode',
      k1: input.text.k1 ?? 1.2,
      ranking: input.text.ranking ?? 'relevance',
      maxTokenLength: input.text.maxTokenLength ?? 128,
      fields: Object.fromEntries(
        fields.map(([alias, f]) => {
          if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(alias) || !f)
            throw new TypeError('Invalid text field alias.');
          compileQuery({ filters: [{ field: f.path, op: 'eq', value: null }] });
          analyzer(f.analyzer ?? output.text?.analyzer ?? input.text.analyzer);
          return [
            alias,
            {
              path: f.path,
              weight: f.weight ?? 1,
              b: f.b ?? 0.75,
              analyzer: f.analyzer ?? input.text.analyzer ?? 'unicode',
            },
          ];
        }),
      ),
    };
    lexicalEngine(output); // Upstream validates weighting, BM25 and tokenizer limits.
  } else if (input.text !== undefined) throw new TypeError('Vector indexes cannot configure text.');
  if (input.kind !== 'lexical') {
    const v = input.vector;
    if (!v) throw new TypeError('Vector configuration is required.');
    compileQuery({ filters: [{ field: v.path, op: 'eq', value: null }] });
    const metric = v.metric ?? 'cosine',
      strategy = v.strategy ?? 'exact';
    if (!['cosine', 'dot'].includes(metric) || !['exact', 'turboquant'].includes(strategy))
      throw new TypeError('Unknown vector metric or strategy.');
    if (strategy === 'turboquant' && metric !== 'cosine')
      throw new TypeError('TurboQuant requires cosine.');
    output.vector = {
      path: v.path,
      dimensions: integer(v.dimensions, 'dimensions', strategy === 'turboquant' ? 2 : 1, 65536),
      metric,
      strategy,
      refineCandidates: integer(v.refineCandidates ?? 0, 'refineCandidates', 0),
      seed: integer(v.seed ?? 42, 'seed', 0, 0xffffffff),
      clip: v.clip ?? 3,
    };
    if (
      !Number.isFinite(output.vector.clip) ||
      output.vector.clip! <= 0 ||
      output.vector.clip! > 100
    )
      throw new RangeError('clip must be in (0, 100].');
  } else if (input.vector !== undefined)
    throw new TypeError('Lexical indexes cannot configure vectors.');
  return output;
}
/** Stable scaling avoids overflow/underflow during cosine normalization. Never mutate caller buffers. */
export function searchVector(input: unknown, options: VectorIndexOptions): Float32Array {
  if (
    !(Array.isArray(input) || input instanceof Float32Array || input instanceof Float64Array) ||
    input.length !== options.dimensions
  )
    throw new TypeError(`Expected a numeric vector with ${options.dimensions} dimensions.`);
  let scale = 0;
  for (const value of input) {
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new TypeError('Vector components must be finite numbers.');
    scale = Math.max(scale, Math.abs(value));
  }
  const cosine = options.metric !== 'dot';
  if (cosine && !scale) throw new RangeError('Cosine vectors must have nonzero norm.');
  let squares = 0;
  if (cosine) for (const value of input) squares += (value / scale) ** 2;
  const norm = Math.sqrt(squares);
  const result = Float32Array.from(input, (value) => (cosine ? value / scale / norm : value));
  if (!result.every(Number.isFinite)) throw new RangeError('Vector components overflow Float32.');
  return result;
}
export interface SearchInput {
  fields?: Record<string, string>;
  vector?: Float32Array;
}
export interface SearchState {
  generation: string;
  documents: number;
  bytes: number;
}
export const searchPrefix = (collection: string, index: string) => `p:${collection}:${index}:`;
export const searchStateKey = (collection: string, index: string) => `g:${collection}:${index}`;
export function projectSearch(row: Document, def: SearchIndexDefinition): SearchInput {
  const output: SearchInput = {};
  if (def.text)
    output.fields = Object.fromEntries(
      Object.entries(def.text.fields).map(([alias, f]) => {
        const value = getPath(row, f.path);
        if (value !== null && value !== undefined && typeof value !== 'string')
          throw new TypeError(`Search field ${f.path} must be a string or nullish.`);
        return [alias, value ?? ''];
      }),
    );
  if (def.vector) {
    const value = getPath(row, def.vector.path);
    if (value !== null && value !== undefined) output.vector = searchVector(value, def.vector);
  }
  return output;
}
export function equalInput(a: SearchInput, b: SearchInput): boolean {
  if (
    JSON.stringify(a.fields) !== JSON.stringify(b.fields) ||
    a.vector?.length !== b.vector?.length
  )
    return false;
  if (a.vector)
    for (let i = 0; i < a.vector.length; i++) if (a.vector[i] !== b.vector![i]) return false;
  return true;
}
export function inputBytes(input: SearchInput): number {
  let bytes = 64 + (input.vector?.byteLength ?? 0);
  for (const [key, value] of Object.entries(input.fields ?? {}))
    bytes += 32 + 2 * (key.length + value.length);
  return bytes;
}
export function readSearchState(value: unknown): SearchState {
  const state = value as SearchState;
  if (
    !state ||
    typeof state.generation !== 'string' ||
    !state.generation ||
    !Number.isSafeInteger(state.documents) ||
    state.documents < 0 ||
    !Number.isSafeInteger(state.bytes) ||
    state.bytes < 0
  )
    throw new DatabaseError('CORRUPT', 'Invalid search index state.');
  return state;
}
