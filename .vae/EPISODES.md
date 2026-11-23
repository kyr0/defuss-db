# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-11-19T22:12:27Z s=19560c1d FINDING scripts/serve-site.mjs learn=none: observability fix (error handler exits 1 with an ISO-8601 ERROR line, SIGTERM closes cleanly), observed via make start/status/stop/log; no rule kind expresses i
2026-11-20T20:18:30Z s=19560c1d FINDING src/server.ts:DirectoryOptions.parallel, src/types.ts:ReadContext.parallel learn=none: the docs gate already enforces the prefix
2026-11-20T20:18:30Z s=19560c1d FINDING docs/assets/site.js:86 (displayMongo comment) learn=none: the docs gate already enforces the prefix
2026-11-20T20:18:30Z s=19560c1d FINDING src/query-pool.ts:createQueryPool (worker 'error' listener) learn=none: no cheap way to inject an uncaught exception into the packaged worker without a test-only hook; the main error path (a failing partial) is covered by the maxGro
2026-11-20T20:18:30Z s=19560c1d FINDING src/query-pool.ts:start learn=none: cause not reproduced; the recorded error makes the next occurrence diagnosable
2026-11-20T20:18:30Z s=19560c1d FINDING docs/OPERATIONS.md: Answer aggregates in worker threads, rule S (style) learn=none: one-off wording; vae.py prose passes
2026-11-20T20:18:30Z s=19560c1d FINDING docs/assets/site.js:displayMongo (ratio chart) learn=none: label collisions inside a canvas are visual; scripts/e2e-site.mjs checks that every chart renders and the page has no horizontal overflow, not label geometry
2026-11-20T20:18:30Z s=19560c1d FINDING docs/assets/site.css:--db-chart-a/--db-chart-b learn=none: the tokens carry a comment with the validation; one-off palette choice
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/data.ts:3, db/orders.ts:4,88, db/store.ts:3, db/treasury.ts treasury.pin learn=none: the docs gate enforces the prefix form
2026-11-20T21:10:10Z s=19560c1d FINDING docs/ (generated) learn=none: generated output; its sources are reviewed
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/release.mjs:26 learn=none: make release is not part of make verify; running it creates a release archive, so it was not executed here
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/site.mjs llms.txt template learn=none: make site already fails closed on a syntax error
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/e2e-site.mjs playground restart step learn=none: test harness detail, covered by the e2e itself
2026-11-20T21:10:10Z s=19560c1d FINDING website/index.html #demo, docs/assets/site.css .db-playground* learn=none: visual collision of class names; e2e checks render, errors and overflow, not appearance
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/app.css narrow bar learn=none: layout inside a frame; e2e-demo checks overflow of the page, not clipping of a flex row
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/db/treasury.ts treasury.pin learn=none: the failure path needs snapshot() to reject, which no cheap probe produces
2026-11-20T21:10:10Z s=19560c1d FINDING tests/browser-examples.ts (was website/demo-worker.ts) learn=none: make e2e asserts the 18 checks
2026-11-20T21:10:10Z s=19560c1d FINDING package.json lint and format scripts learn=none: make lint runs both
2026-11-20T23:14:53Z s=19560c1d FINDING website/index.html (whole file) learn=none: the author and content of the out-of-session edit are not known; the human was asked
2026-11-21T00:52:25Z s=19560c1d FINDING whole repository (git index) learn=none: staging changes the fingerprint without changing content
2026-11-21T04:24:30Z s=19560c1d DONE fp=75fb949824b7 cov=93.0% paths=ARCH.md,CHANGELOG.md,docs/OPERATIONS.md,docs/PERFORMANCE.md(+24)
2026-11-21T04:24:30Z s=19560c1d FINDING scripts/bench-stats.mjs (+ .d.mts), tests/bench-stats.test.ts, scripts/bench-mongo.mjs (5 bulk-load rounds), scripts/mongo-report.mjs (comparison, relativeText, chart data with ratio/low/high/verdict, loadRounds and per-round sample checks), scripts/site-evidence.mjs (method text, table header), scripts/check-site.mjs (verdict guards), docs/assets/site.js + site.css (verdict colours, CI whiskers, caption), website/index.html (headline, cards, section title, comparison paragraph, legend), src/compaction.ts (minBytes 1 MiB, IDLE_REORDER 1.5), tests/compaction.test.ts, ARCH/CHANGELOG/OPERATIONS/MEMORY, regenerated docs/benchmarks, PERFORMANCE, VALIDATION, guides, index, demo worker learn=test: tests/bench-stats.test.ts, tests/compaction.test.ts (1.5x reorder), scripts/check-site.mjs verdict guards, scripts/mongo-report.mjs pairing assertions
2026-11-21T04:26:36Z s=19560c1d DONE fp=c77110e3b7b9 cov=93.0% paths=ARCH.md,CHANGELOG.md,docs/OPERATIONS.md,docs/PERFORMANCE.md(+24)
2026-11-21T04:35:32Z s=19560c1d DONE fp=4445a1228946 cov=93.0% paths=ARCH.md,CHANGELOG.md,docs/OPERATIONS.md,docs/PERFORMANCE.md(+30)
2026-11-21T04:35:32Z s=19560c1d FINDING website/index.html hero (tabs + 3 panels, caption), website/examples/orders.{browser,server,memory}.ts (orders.ts removed), scripts/site.mjs variantLines/withExamples, docs/assets/site.js hero rotation, docs/assets/site.css hero tabs/progress/db-diff, scripts/e2e-site.mjs hero steps, regenerated docs/index.html learn=test: scripts/e2e-site.mjs hero steps; scripts/site.mjs variant alignment assertion
2026-11-21T19:58:47Z s=19560c1d FAIL tests.e2e.1,release.version-sync,docs.performance-evidence
2026-11-21T20:08:59Z s=19560c1d DONE fp=c86849684c62 cov=93.1% paths=ARCH.md,CHANGELOG.md,README.md,bun.lock(+25)
2026-11-21T20:08:59Z s=19560c1d FINDING src/mutations.ts:enableTimestamps + stamp() keep branch learn=test: tests/timestamps.test.ts 'keep archived timestamps...' fails without the fix and passes with it.
2026-11-21T20:08:59Z s=19560c1d FINDING src/collection.ts:TransactionCollection.restore learn=test: tests/timestamps.test.ts restore fork case fails without the fallback.
2026-11-21T20:08:59Z s=19560c1d FINDING src/collection.ts:TransactionCollection.restore learn=test: restore tests cover a tracked collection without timestamps.
2026-11-21T20:08:59Z s=19560c1d FINDING src/database.ts:ensureCollection learn=test: tests/timestamps.test.ts resume test checks exactly 128 stamped, verify while pending, resume, CORRUPT on an unstamped raw doc.
2026-11-21T20:08:59Z s=19560c1d FINDING src/workload-report.mjs:loadReports learn=verifier: rule docs.performance-evidence (site-evidence --check) and release.version-sync enforce the state.
2026-11-21T14:38:31Z s=19560c1d FAIL release.version-sync
2026-11-21T20:21:43Z s=19560c1d DONE fp=9884aba70f8e cov=93.4% paths=CHANGELOG.md,README.md,docs/API.md,docs/guides/api.html(+10)
2026-11-21T20:21:43Z s=19560c1d FINDING src/mongo-query.ts:translateFilter/condition learn=test: tests/mongo.test.ts 'MongoDB matching rules' holds the ids MongoDB returned.
2026-11-21T20:21:43Z s=19560c1d FINDING src/mongo-pipeline.ts:translatePipeline $dateTrunc learn=test: tests/mongo.test.ts calendar-keys test (MongoDB values) and refusal cases fail on the original translator.
2026-11-21T20:21:43Z s=19560c1d FINDING src/mongo-pipeline.ts:keyOutput $dateToString learn=test: same test.
2026-11-21T20:21:43Z s=19560c1d FINDING src/mongo-pipeline.ts:aggregateDescriptor; tests/mongo.test.ts grouping probe learn=none: YAGNI cleanup; no recurrence mechanism.
2026-11-21T20:21:43Z s=19560c1d FINDING docs/API.md MongoDB syntax learn=none: needs a dataview any-element expression and a nullish sort option; follow-up for the user.
2026-11-22T00:44:49Z s=19560c1d FAIL lint
2026-11-22T00:51:55Z s=19560c1d DONE fp=a574a69e1e02 cov=93.8% paths=CHANGELOG.md,README.md,docs/API.md,docs/HISTORY.md(+10)
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:pattern learn=test: tests/mongo.test.ts refusal case and fixture regex cases
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:regexTest learn=test: tests/mongo-semantics.json regex cases
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:bitsTest learn=test: fixture $bits cases on 2^53, 2^60, -2^60
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:compareTest,twin learn=test: fixture cases around 2^53
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:elementMatch learn=test: fixture $elemMatch logic cases
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:compareTest,scalarFilters learn=test: fixture NaN cases, refusal test for an invalid Date
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:translateFilter learn=test: refusal test
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:scalarOptions learn=test: historic view test in tests/mongo.test.ts; MEMORY line for the unfixed history-view index crash
2026-11-22T00:51:55Z s=19560c1d FINDING src/mongo-query.ts:rules comment, docs/API.md:176 learn=memory: .vae/MEMORY.md planner line; test asserts equality access for an indexed equality
2026-11-22T00:51:55Z s=19560c1d FINDING tests/mongo.test.ts:aggregateMongo calendar test learn=none: comment fixed to name the probe it rests on
2026-11-22T01:19:59Z s=19560c1d DONE fp=f8c824b2c913 cov=93.8% paths=CHANGELOG.md,README.md,docs/API.md,docs/HISTORY.md(+15)
2026-11-22T01:19:59Z s=19560c1d FINDING src/history-view.ts:build learn=test: tests/history.test.ts compares five requests with access:'scan' answers; a mutation forcing complete=true fails it
2026-11-22T01:19:59Z s=19560c1d FINDING src/source.ts:planAccess,choose learn=test: explain assertions for past, later and live views in tests/history.test.ts
2026-11-22T01:19:59Z s=19560c1d FINDING src/history-view.ts:build (oversized keys) learn=test: tests/history.test.ts 'key limit' with a four-field compound index and a 450-unit ID
2026-11-22T01:19:59Z s=19560c1d FINDING src/history-view.ts:scan learn=test: rejects assertions for pageByIndex and countByIndex at dt(4), and pageByIndex at dt(9) returns all three documents
2026-11-22T01:19:59Z s=19560c1d FINDING src/mongo-query.ts:scalarOptions learn=test: historic view test in tests/mongo.test.ts
2026-11-22T01:19:59Z s=19560c1d FINDING src/mongo-query.ts:rules comment, docs/API.md learn=memory: .vae/MEMORY.md planner line; test asserts equality access for an indexed equality
2026-11-22T01:36:45Z s=19560c1d FAIL release.version-sync
2026-11-22T01:41:52Z s=19560c1d DONE fp=3fbf50dcb581 cov=93.8% paths=CHANGELOG.md,README.md,bun.lock,docs/API.md(+17)
2026-11-22T02:28:34Z s=19560c1d DONE fp=6d12a7fb85dc cov=93.8% paths=CHANGELOG.md,README.md,docs/PERFORMANCE.md,docs/VALIDATION.md(+13)
2026-11-22T02:28:34Z s=19560c1d FINDING scripts/workload-report.mjs:loadReports, scripts/mongo-report.mjs:loadMongoReports learn=verifier: make site and the docs.performance-evidence rule run loadReports/loadMongoReports on every gate
2026-11-22T02:28:34Z s=19560c1d FINDING scripts/site.mjs:release, scripts/site-evidence.mjs learn=verifier: node scripts/site-evidence.mjs --check passes on the rendered page
2026-11-22T02:28:34Z s=19560c1d FINDING website/index.html:#mongodb comparison table learn=none: page text; tests/mongo.test.ts covers the refusals
2026-11-22T02:28:34Z s=19560c1d FINDING website/index.html:#mongodb-queries Indexes term learn=memory: .vae/MEMORY.md planner line
2026-11-22T02:28:34Z s=19560c1d FINDING website/examples/mongo.ts learn=verifier: make lint typechecks website/examples
2026-11-22T02:28:34Z s=19560c1d FINDING website/index.html layout learn=none: scripts/e2e-site.mjs covers every page in the gate
2026-11-22T13:44:29Z s=19560c1d FAIL coverage
2026-11-22T13:50:05Z s=19560c1d DONE fp=7bd0e00730e9 cov=93.8% paths=bun.lock,docs/assets/site.js,docs/database-explorer/SOURCES.json,docs/database-explorer/db-explorer.min.css(+23)
2026-11-22T13:50:05Z s=19560c1d FINDING docs/database-explorer/index.html seed (defuss-shadcn scaffold-db-explorer.mdx seed) learn=test: scripts/e2e-site.mjs runs both cases in fresh browser profiles: a visit after one was left during the seed, and a second tab during the seed
2026-11-22T13:50:05Z s=19560c1d FINDING scripts/explorer-sync.mjs copy step learn=memory: .vae/MEMORY.md 'database explorer' line: wait until no build-docs runs, with a pgrep pattern that cannot match its own shell; check-site fails on any copied fil
2026-11-22T13:50:05Z s=19560c1d FINDING docs/assets/site.js themeExplorer learn=test: scripts/e2e-site.mjs checks the theme after a switch and after a reload with a stored theme that differs from the system's
2026-11-22T13:50:05Z s=19560c1d FINDING scripts/e2e-site.mjs explorer theme assertions learn=test: the mutation runs above fail the e2e
2026-11-22T13:50:05Z s=19560c1d FINDING scripts/ARCH.md:11 P08, P05 learn=none: page text matching scripts/e2e-site.mjs
2026-11-22T13:50:05Z s=19560c1d FINDING scripts/ARCH.md:13 P09, A10 learn=none: page text matching scripts/explorer-sync.mjs
2026-11-22T13:50:05Z s=19560c1d FINDING website/ARCH.md:11 A10, B01 learn=none: page text
2026-11-22T15:14:53Z s=19560c1d DONE fp=485d8ed43caf cov=93.8% paths=bun.lock,docs/assets/site.css,docs/assets/site.js,docs/database-explorer/SOURCES.json(+25)
2026-11-22T15:54:55Z s=19560c1d DONE fp=6fd9fbb58afb cov=93.8% paths=Makefile,bun.lock,docs/API.md,docs/application/SOURCES.json(+226)
2026-11-22T15:54:55Z s=19560c1d FINDING scripts/api-docs.mjs docOf learn=none: a presentation choice of the generator; the signature block still prints every overload
2026-11-22T15:54:55Z s=19560c1d FINDING website/application/app-api-docs.html rpcArgs learn=test: scripts/e2e-site.mjs sends every member's example on a fresh sample and fails on any error
2026-11-22T15:54:55Z s=19560c1d FINDING scripts/check-site.mjs comparison-paragraph claims learn=none: dead check removed; website/ARCH.md now names only the scale section
2026-11-22T15:54:55Z s=19560c1d FINDING website/application/sample.mjs samples (Mongo) learn=none: sample text; the e2e checks the calls, not the wording
2026-11-22T15:54:55Z s=19560c1d FINDING scripts/api-docs.mjs member tables learn=none: generated Markdown only; the app renders from the data block
2026-11-22T15:54:55Z s=19560c1d FINDING scripts/shadcn-sync.mjs (was explorer-sync.mjs) learn=memory: .vae/MEMORY.md 'defuss-shadcn copies' line replaces the old wait-for-build advice
2026-11-23T11:31:29Z s=131abc06 FAIL tests.e2e.1
2026-11-23T11:44:25Z s=131abc06 DONE fp=56ab17526d1e cov=94.0% paths=ARCH.md,CHANGELOG.md,README.md,docs/API.md(+49)
2026-11-23T11:44:25Z s=131abc06 FINDING src/json-schema.ts:inferSchema (add, primaryKey) learn=test: tests/json-schema.test.ts 'a document's own id is no enum' and the packed consumer in scripts/e2e.mjs
2026-11-23T11:44:25Z s=131abc06 FINDING src/collection.ts:Collection.setSchema learn=test: tests/schema-validation.test.ts asserts schema() stays undefined after the RangeError
2026-11-23T11:44:25Z s=131abc06 FINDING src/validate.ts:checkSchema (x-dson) learn=test: tests/schema-validation.test.ts 'refuses a keyword or format it would not enforce'
2026-11-23T11:44:25Z s=131abc06 FINDING src/validate.ts:visit (format) learn=none: reachable only with a schema that skipped checkSchema, whose behavior no requirement states
2026-11-23T11:44:25Z s=131abc06 FINDING tests/history.test.ts:457 learn=test: tests/history.test.ts derives the publication revision as revision - 1; tests/database.test.ts keeps concurrent ensureCollection and first writes conflict-free
2026-11-23T15:08:19Z s=131abc06 DONE fp=53ca468291d8 cov=94.2% paths=ARCH.md,CHANGELOG.md,README.md,docs/API.md(+74)
2026-11-23T15:08:19Z s=131abc06 FINDING src/history-prune.ts:applyPlans / src/collection.ts:Collection.prune learn=test: tests/history-prune.test.ts 'stays consistent while documents are written' fails with the scanning form
2026-11-23T15:08:19Z s=131abc06 FINDING src/history-store.ts:assertChange (head row) learn=test: tests/history-prune.test.ts 'does not stage a plan that was read before a later correction'; both mutations (conditional head put, no staleness check) fail it
2026-11-23T15:08:19Z s=131abc06 FINDING src/history-prune.ts:planId (pruneDeleted count) learn=test: tests/history-prune.test.ts 'removes a deleted document with more versions than one transaction holds'
2026-11-23T16:19:42Z s=131abc06 DONE fp=9e6003fd7849 cov=94.2% paths=ARCH.md,CHANGELOG.md,README.md,docs/API.md(+82)
2026-11-23T19:29:10Z s=131abc06 DONE fp=6226ac34bf35 cov=94.2% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+127)
2026-11-23T19:29:10Z s=131abc06 FINDING scripts/bench-history.mjs, scripts/bench-mongo.mjs (one run published) -> scripts/bench-merge.mjs:mergeRuns learn=verifier: loadReports and loadMongoReports call assertMerged: a single-run report, or one that is not the merge of its runs, fails make site and rule docs.performance-evi
2026-11-23T19:29:10Z s=131abc06 FINDING scripts/site-evidence.mjs (Reproduce paragraph) learn=none: a wording choice; no rule kind expresses it
2026-11-23T19:29:10Z s=131abc06 FINDING scripts/site-evidence.mjs (collection load sentence), scripts/site.mjs:mongoContext learn=verifier: the texts render report.fixture.loadRounds, and site-evidence --check compares the page with the reports
