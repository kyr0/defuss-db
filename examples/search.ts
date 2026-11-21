import { openDirectory } from '../src/server.js';
import type { Document } from '../src/index.js';

interface Article extends Document {
  title: string;
  body: string;
  embedding: Float32Array;
  published: boolean;
}
const db = await openDirectory('./output/search-example');
try {
  const articles = db.collection<Article>('articles');
  await articles.createSearchIndex({
    name: 'discovery',
    kind: 'hybrid',
    text: { fields: { title: { path: 'title', weight: 3 }, body: { path: 'body' } } },
    vector: { path: 'embedding', dimensions: 3, metric: 'cosine' },
  });
  // Supply embeddings from your model; the database never invokes a model or a network service.
  await articles.put({
    id: 'intro',
    title: 'Local databases',
    body: 'Transactional search in a browser or on a server.',
    embedding: new Float32Array([1, 0.2, 0.1]),
    published: true,
  });
  const result = await articles.search(
    'discovery',
    { text: 'local database', vector: [0.9, 0.3, 0.1] },
    {
      limit: 10,
      filter: { where: articles.q.eq(articles.q.field('published'), articles.q.literal(true)) },
      hybrid: {
        strategy: 'fusion',
        lexicalCandidates: 100,
        vectorCandidates: 100,
        fusion: { method: 'rrf', k: 60, weights: { lexical: 1, vector: 1 } },
      },
    },
  );
  console.log(result.hits.map(({ id, score, document }) => ({ id, score, title: document.title })));
} finally {
  await db.close();
}
