// The Search tab's server side: a lexical search index over 5,000 catalog items. The Autocomplete sends one request
// per keystroke and page; the worker answers it with collection.search(), filtering by category and stock before
// ranking.
import type { Database } from 'defuss-db';
import { ts } from '../shared/code.js';
import type { Filter, Ops } from '../shared/protocol.js';
import type { Item } from '../shared/records.js';
import { catalogBatches } from '../data.js';
import { plural, timed } from './trace.js';

export const CATALOG_COUNT = 5_000;
const INDEX = 'catalog';

export async function seedCatalog(db: Database, progress: (done: number, total: number) => void) {
  const catalog = db.collection<Item>('catalog');
  // Declared first: every insertMany then stages the projected search inputs with its documents.
  await catalog.createSearchIndex({
    name: INDEX,
    kind: 'lexical',
    text: {
      fields: {
        name: { path: 'name', weight: 3, analyzer: 'en' },
        brand: { path: 'brand', weight: 2 },
        description: { path: 'description', analyzer: 'en' },
      },
    },
  });
  let done = 0;
  for (const batch of catalogBatches(CATALOG_COUNT)) {
    await catalog.insertMany(batch);
    progress((done += batch.length), CATALOG_COUNT);
  }
}

export function catalogApi(db: () => Promise<Database>) {
  return {
    async 'catalog.search'({
      query,
      page,
      pageSize,
      category,
      inStock,
    }: Ops['catalog.search']['args']): Promise<Ops['catalog.search']['result']> {
      const catalog = (await db()).collection<Item>('catalog');
      const filters: Filter[] = [];
      if (category) filters.push({ field: 'category', op: 'eq', value: category });
      if (inStock) filters.push({ field: 'inStock', op: 'eq', value: true });
      const options = {
        offset: page * pageSize,
        limit: pageSize,
        // all words must match; the last one may be a prefix of a word, and each may be one edit away
        lexical: { operator: 'all' as const, prefix: true, fuzzy: 1 as const },
        ...(filters.length ? { filter: { filters } } : {}),
      };
      const [result, ms] = await timed(() => catalog.search(INDEX, query, options));
      return {
        rows: result.hits.map((hit) => ({ ...hit.document, score: hit.score })),
        total: result.totalCandidates,
        trace: {
          what: `catalog.search(): ${plural(result.hits.length, 'hit')} of ${plural(result.totalCandidates, 'match', 'matches')}${
            result.cacheHit ? '' : ', search engine built from the persisted inputs first'
          }`,
          ms,
          access: filters.length
            ? `filters checked ${plural(result.filterScannedRows, 'document')} before ranking`
            : 'every document is eligible',
          code: `const result = await catalog.search('${INDEX}', ${ts(query)}, ${ts(options)});
// result.hits: { id, score, rank, document }; result.totalCandidates: every match`,
        },
      };
    },
  };
}
