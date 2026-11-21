# Search indexes

Search is embedded and isomorphic. `createSearchIndex`, `dropSearchIndex`, `searchIndexes` and `search` work with directory, OPFS and memory storage. Read APIs also work on snapshots and transaction collections; mutations inside a transaction participate in its single atomic commit. No query performs embedding inference or downloads a model.

## Define an index

```ts
await documents.createSearchIndex({
  name: 'discovery', kind: 'hybrid',
  text: {
    analyzer: 'unicode', k1: 1.2, ranking: 'relevance', maxTokenLength: 128,
    fields: {
      title: { path: 'title', weight: 3, analyzer: 'en', b: 0.75 },
      body: { path: 'content.body', weight: 1 },
    },
  },
  vector: {
    path: 'embedding', dimensions: 384, metric: 'cosine', strategy: 'exact',
  },
  maxDocuments: 100_000,
  maxInputBytes: 64 * 1024 * 1024,
});
```

| Kind | Required configuration | Engine |
| --- | --- | --- |
| `lexical` | `text` | defuss-lexicalsearch 0.4.0 |
| `vector` | `vector` | defuss-vectorsearch 0.4.0 through the defuss-search vector adapter |
| `hybrid` | `text` and `vector` | defuss-search 0.5.0 with both retrievers |

A text field alias is the name used by lexical syntax and query field restrictions; its `path` identifies the document's own-property dot path. Fields accept strings; missing/null becomes empty text. Other types reject the write/build rather than stringify silently. Configure 1–32 fields. Weight is positive; BM25 `b` is in [0,1]. Scalar options retain upstream validation.

Analyzers: `unicode`, `code`, `keyword`, `folded-keyword`, `whitespace`, `accent-folded`, and `en de es fr it pt nl pl ru tr id vi ar ur hi bn ja zh ko th`. The named language analyzers use the upstream tokenization/stemming/stopword/phonetic implementations. Query `language` can boost matching language fields. Executable custom analyzers are not serialized into storage.

Vectors accept `number[]`, `Float32Array` or `Float64Array`, with exactly the declared dimension and finite components. Missing/null vectors are sparse: those documents stay in a hybrid lexical corpus but are absent from its vector corpus. Cosine requires a nonzero vector, normalizes using stable scaling, and stores Float32 inputs. Dot supports zero vectors, rejecting Float32 overflow. Other native JavaScript fields retain ordinary DSON storage semantics.

`strategy: 'turboquant'` uses upstream quantized scoring, requires cosine and at least 2 dimensions, and optionally rescans a shortlist using exact float scores (`refineCandidates`, default 0). `seed` defaults to 42; `clip` defaults to 3. Dimensions are at most 65,536. TurboQuant is a compressed scan, not an ANN graph; approximation can change ranking. Exact mode is the default.

Declarations are idempotent when their normalized definitions match. Reusing a name with a different definition rejects. Drop and recreate explicitly to change a definition. Up to 16 search indexes per collection; search and equality-index names have separate namespaces.

## Query

```ts
const result = await documents.search('discovery', {
  text: 'distributed "document database"',
  vector: queryEmbedding,
  language: 'en',
}, {
  limit: 20, offset: 0,
  ids: ['allowed-1', 'allowed-2'],
  filter: { where: documents.q.eq(documents.q.field('published'), documents.q.literal(true)) },
  lexical: { operator: 'any', fuzzy: 1, prefix: true, explain: true },
  hybrid: {
    strategy: 'fusion', lexicalCandidates: 100, vectorCandidates: 100,
    fusion: { method: 'rrf', k: 60, weights: { lexical: 1, vector: 1 } },
    exact: 'promote',
  },
  signal: abortController.signal,
});
```

A lexical index accepts a string or `{ text, language? }`. Vector/hybrid queries require `{ text, vector }`; vector-only searches can use `text: ''`. The query vector is application-owned and captured before asynchronous work. Text is at most 16,384 UTF-16 units. `limit` defaults to 10, `offset` to 0, and `offset + limit` is at most 10,000. At most 100,000 typed IDs may be supplied.

`lexical` forwards upstream query controls: Boolean operator, phrase syntax, fields, fuzzy edit distance, transpositions, prefix/suffix/substring expansion, literal exact/prefix/suffix/substring modes, case sensitivity, phonetic matching, exclusions, language boost, ranking and match explanations. Incompatible controls reject according to upstream semantics. It intentionally excludes upstream metadata callbacks/IDs/pagination: use database `filter`, `ids`, `limit` and `offset`.

`hybrid` forwards fusion (`rrf` or `linear`), `vector-first`/`lexical-first` cascades, candidate counts, unmatched handling, source balance, language-specific weights, weak-lexical rules, vector-only routing and optional literal exact promotion. Exact promotion compares configured text fields against the original query text. No neural reranker runs. Candidate budgets default to 25 per source and remain fixed across pages; increase them explicitly when requesting deeper pages. Fusion scores are ranking values, not probabilities.

Both `ids` and arbitrary DataView `filter` predicates restrict eligibility **before** retrieval top-k. They intersect when both are present. Eligibility uses the regular snapshot-bound candidate planner. A short ID list, equality tuple or selective ordered range can reduce predicate evaluation. The complete DataView predicate runs on every candidate and BM25 uses full-corpus statistics. Request `filter: { filters, access: 'scan' }` to force the reference path. With a predicate and at most 256 explicit `ids`, the planner can use typed document point reads. Search results can then be projected/grouped with DataView over their documents, or use the ordinary collection query APIs independently; score-aware joins are not added implicitly.

Each result contains:

| Field | Meaning |
| --- | --- |
| `hits` | `{ id, score, rank, document, lexical?, hybrid? }`; document is an owned DSON decode |
| `filterScannedRows` | Candidate documents evaluated for predicate eligibility. Zero when no filter is supplied. Engine retrieval has its own cost. |
| `revision` | One storage snapshot used for definition, eligibility, engine inputs and hit documents |
| `generation` | Persisted UUID for the search inputs |
| `kind` | Index kind |
| `cacheHit` | Whether a complete engine for that generation was already available |
| `totalCandidates` | Lexical: full match count; vector: eligible vectors; hybrid: finite retrieved candidate pool, not full-corpus count |

Typed IDs remain distinct: `1`, `1n`, `'1'` never collapse. Lexical/hybrid hit details omit internal encoded IDs. Query buffers, option objects and IDs are captured before the first await. Transactions enforce sequential public operations as for other database APIs.

## Persistence, cache and costs

Every indexed document has one derived input record per search index, including sparse-vector documents. A mutation validates/projects its inputs and stages changes atomically with the document and generation state. Unchanged projected fields do not rewrite inputs or invalidate the generation. Deletes remove inputs; index drop removes all its inputs and metadata. Unique equality checks and search validation failure roll back together.

Persisted inputs are the durable index representation. The first search after reopening, eviction or an indexed-field mutation rebuilds the upstream in-memory engine from that generation. The engine reads persisted inputs in native batches of up to 128 records and calls lexical `addAll` once per batch; transaction scans use a bounded row-batch fallback. This reduces reconstruction overhead while retaining capacity checks. Warm queries reuse it. Snapshots retain old inputs through DBSONL generation pins; old cache entries are safe to reuse. Cross-process writes are detected by persisted UUIDs, not notifications. Concurrent cold searches may build independently; no promise tied to one caller's snapshot/cancellation is shared.

The per-database LRU retains at most four engines and 128 MiB of estimated input payloads. Each index defaults to 100,000 documents and 64 MiB estimated text/vector input bytes. These counters bound inputs, not total JavaScript heap usage; token postings, IDs, vectors, quantized data, maps and allocator overhead add memory. Cold reconstruction and CPU scoring are not a hard real-time cancellation boundary; cancellation is checked during input scans and around engine stages.

Build/drop and document mutations must fit DBSONL transaction budgets. Declaring before ingestion avoids a single large backfill transaction. For larger atomic backfills, raise `maxTransactionOperations` and `maxTransactionBytes` deliberately. There is no partial-index publication. Exact vector retrieval and quantized scoring scan eligible corpus data; current upstream adapters also sort candidates. No disk-resident postings, HNSW/ANN graph, incremental engine patching, disk spill or automatic embeddings are claimed.

## Package graph

Search imports only the upstream lexical engines, hybrid planner and slim vector/TurboQuant adapter paths at runtime. Packed browser tests reject native locking/server, inference runtime and multicore-worker imports in the bundle. However, **defuss-vectorsearch 0.4.0's published manifest** still declares embedding packages and legacy `defuss-db ^2.0.0`; package managers install those transitive dependencies, including the legacy provider dependencies. They do not implement this database's storage and are not executed by its search path. Removing that installation overhead requires an upstream package split or dependency change, not an unsafe override of legacy APIs.
