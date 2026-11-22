# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-11-19T22:12:27Z s=19560c1d FINDING scripts/serve-site.mjs learn=none: observability fix (error handler exits 1 with an ISO-8601 ERROR line, SIGTERM closes cleanly), observed via make start/status/stop/log; no rule kind expresses i
2026-11-20T00:12:34Z s=19560c1d FINDING scripts/site-evidence.mjs (warm cache sentence) learn=memory: wording only
2026-11-20T19:40:17Z s=19560c1d FAIL tests.e2e.1,docs.performance-evidence
2026-11-20T20:18:30Z s=19560c1d DONE fp=51f06e40c707 cov=92.9% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+91)
2026-11-20T20:18:30Z s=19560c1d FINDING src/server.ts:DirectoryOptions.parallel, src/types.ts:ReadContext.parallel learn=none: the docs gate already enforces the prefix
2026-11-20T20:18:30Z s=19560c1d FINDING docs/assets/site.js:86 (displayMongo comment) learn=none: the docs gate already enforces the prefix
2026-11-20T20:18:30Z s=19560c1d FINDING src/source.ts:createDocumentSource learn=test: tests/batches.test.ts checks every key once and in order across the bounded first scan and in dbsonl worker threads, and that aggregates and first pages equal o
2026-11-20T20:18:30Z s=19560c1d FINDING src/query-pool.ts:stop learn=test: scripts/e2e.mjs packed ESM and CommonJS consumers close a database with running query workers at top level under Node and Bun; a hang fails them
2026-11-20T20:18:30Z s=19560c1d FINDING src/query-pool.ts:createQueryPool (worker 'error' listener) learn=none: no cheap way to inject an uncaught exception into the packaged worker without a test-only hook; the main error path (a failing partial) is covered by the maxGro
2026-11-20T20:18:30Z s=19560c1d FINDING src/query-pool.ts:start learn=none: cause not reproduced; the recorded error makes the next occurrence diagnosable
2026-11-20T20:18:30Z s=19560c1d FINDING scripts/bench-mongo.mjs:flushProbe learn=memory: .vae/MEMORY.md flush line: probes must go through defuss-storage
2026-11-20T20:18:30Z s=19560c1d FINDING website/index.html:127, scripts/check-site.mjs learn=verifier: scripts/check-site.mjs fails the site build when a claim of the comparison paragraph stops matching docs/benchmarks/mongodb-node.json
2026-11-20T20:18:30Z s=19560c1d FINDING scripts/bench-mongo.mjs:121, scripts/bench-history.mjs:settled learn=memory: .vae/MEMORY.md bench fairness line covers waiting for background state before timing
2026-11-20T20:18:30Z s=19560c1d FINDING docs/OPERATIONS.md: Answer aggregates in worker threads, rule S (style) learn=none: one-off wording; vae.py prose passes
2026-11-20T20:18:30Z s=19560c1d FINDING docs/assets/site.js:displayMongo (ratio chart) learn=none: label collisions inside a canvas are visual; scripts/e2e-site.mjs checks that every chart renders and the page has no horizontal overflow, not label geometry
2026-11-20T20:18:30Z s=19560c1d FINDING docs/assets/site.css:--db-chart-a/--db-chart-b learn=none: the tokens carry a comment with the validation; one-off palette choice
2026-11-20T20:18:30Z s=19560c1d FINDING website/index.html code windows and setup snippets learn=verifier: Makefile lint recipe typechecks website/examples
2026-11-20T20:18:30Z s=19560c1d FINDING scripts/check-site.mjs (MongoDB charts, scale card) learn=verifier: scripts/check-site.mjs runs in make site and make e2e
2026-11-20T20:18:30Z s=19560c1d FINDING .vae/MEMORY.md bulk load line learn=memory: recorded so later agents do not re-test the falsified causes
2026-11-20T20:27:58Z s=19560c1d FAIL release.version-sync
2026-11-20T20:34:49Z s=19560c1d FAIL tests.e2e.1
2026-11-20T20:50:21Z s=19560c1d FAIL prose
2026-11-20T21:10:10Z s=19560c1d DONE fp=829a8efb661f cov=92.9% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+130)
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/data.ts:3, db/orders.ts:4,88, db/store.ts:3, db/treasury.ts treasury.pin learn=none: the docs gate enforces the prefix form
2026-11-20T21:10:10Z s=19560c1d FINDING docs/ (generated) learn=none: generated output; its sources are reviewed
2026-11-20T21:10:10Z s=19560c1d FINDING .vae/checks/version_sync.py learn=verifier: rule release.version-sync runs the check
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/release.mjs:26 learn=none: make release is not part of make verify; running it creates a release archive, so it was not executed here
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/site.mjs llms.txt template learn=none: make site already fails closed on a syntax error
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/check-site.mjs:21 link resolution learn=verifier: check-site runs in make site and the gate's e2e
2026-11-20T21:10:10Z s=19560c1d FINDING scripts/e2e-site.mjs playground restart step learn=none: test harness detail, covered by the e2e itself
2026-11-20T21:10:10Z s=19560c1d FINDING website/index.html #demo, docs/assets/site.css .db-playground* learn=none: visual collision of class names; e2e checks render, errors and overflow, not appearance
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/app.css narrow bar learn=none: layout inside a frame; e2e-demo checks overflow of the page, not clipping of a flex row
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/db/treasury.ts treasury.pin learn=none: the failure path needs snapshot() to reject, which no cheap probe produces
2026-11-20T21:10:10Z s=19560c1d FINDING website/demo/** and scripts/demo-build.mjs, scripts/e2e-demo.mjs (sub-agent work) learn=test: scripts/e2e-demo.mjs runs in make e2e-site
2026-11-20T21:10:10Z s=19560c1d FINDING tests/browser-examples.ts (was website/demo-worker.ts) learn=none: make e2e asserts the 18 checks
2026-11-20T21:10:10Z s=19560c1d FINDING package.json lint and format scripts learn=none: make lint runs both
2026-11-20T21:10:10Z s=19560c1d FINDING .vae/MEMORY.md write cost line learn=memory: recorded so later work starts from the measured breakdown
2026-11-20T23:14:53Z s=19560c1d DONE fp=dfe07765a91e cov=92.9% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+130)
2026-11-20T23:14:53Z s=19560c1d FINDING website/index.html (whole file) learn=none: the author and content of the out-of-session edit are not known; the human was asked
2026-11-20T23:14:53Z s=19560c1d FINDING website/index.html scale card, rule P (precision) learn=verifier: check-site's growth guard keeps the reworded claim true
2026-11-20T23:14:53Z s=19560c1d FINDING .vae/MEMORY.md learn=memory: the dbsonl fix and prototype live outside this repo
2026-11-21T00:21:19Z s=19560c1d FAIL release.version-sync
2026-11-21T00:29:59Z s=19560c1d FAIL prose
2026-11-21T00:31:58Z s=19560c1d DONE fp=299479a48bfb cov=92.9% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+130)
2026-11-21T00:31:58Z s=19560c1d FINDING package.json, bun.lock, README.md:5, docs/SOURCES.md:12, src/database.ts PAGE_CACHE comment, src/compaction.ts rationale, ARCH.md (format, cache, compaction, query workers), CHANGELOG.md, docs/API.md, docs/OPERATIONS.md, website/index.html comparison note, website/ARCH.md, docs/assets/site.js, scripts/check-site.mjs, docs/benchmarks/*.json learn=verifier: scripts/check-site.mjs now asserts every comparison claim against both runtime reports
2026-11-21T00:45:37Z s=19560c1d DONE fp=f37be3bd505d cov=93.0% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+130)
2026-11-21T00:45:37Z s=19560c1d FINDING src/compaction.ts (packedAt, liveBytes, AutoCompactor.run/compacted), src/database.ts compact(), tests/compaction.test.ts, ARCH.md, docs/OPERATIONS.md, README.md:252, src/types.ts:75, CHANGELOG.md, website/index.html, scripts/check-site.mjs learn=test: tests/compaction.test.ts asserts an insert-only load below the bound copies once; MEMORY line records the post-copy count pitfall
2026-11-21T00:52:25Z s=19560c1d DONE fp=320055aa6c38 cov=93.0% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+130)
2026-11-21T00:52:25Z s=19560c1d FINDING whole repository (git index) learn=none: staging changes the fingerprint without changing content
2026-11-21T01:13:58Z s=19560c1d FAIL tests.no-mocks
2026-11-21T01:17:55Z s=19560c1d DONE fp=3f25d4220d89 cov=93.0% paths=ARCH.md,CHANGELOG.md,docs/demo/worker.js,docs/guides/architecture.html(+3)
2026-11-21T01:17:55Z s=19560c1d FINDING src/keys.ts primary/primaryFromToken/escapeId/unescapeId/scalar, tests/index-only.test.ts, tests/history.test.ts, ARCH.md:39, CHANGELOG.md learn=test: tests/history.test.ts pins the separator-safe token and the clock clamp without mocks
2026-11-21T02:55:13Z s=19560c1d DONE fp=fac8b8c5e769 cov=93.0% paths=ARCH.md,CHANGELOG.md,docs/OPERATIONS.md,docs/demo/worker.js(+7)
2026-11-21T02:55:13Z s=19560c1d FINDING src/compaction.ts IDLE_DOUBLING/layoutDue/AutoCompactor.run, tests/compaction.test.ts, ARCH.md, docs/OPERATIONS.md (+ generated docs/guides/operations.html), CHANGELOG.md, .vae/MEMORY.md learn=test: tests/compaction.test.ts pins the doubling trigger; .vae/MEMORY.md storage-space line updated
2026-11-21T03:24:39Z s=19560c1d DONE fp=6e1ce0794ec2 cov=93.0% paths=bun.lock,docs/demo/app.js,package.json
2026-11-21T03:24:39Z s=19560c1d FINDING package.json devDependencies.esbuild, bun.lock, docs/demo/app.js (rebuilt) learn=test: make verify e2e covers the rebuilt demo
2026-11-21T03:32:46Z s=19560c1d FAIL lint
2026-11-21T03:46:50Z s=19560c1d DONE fp=a816ab530c1e cov=93.0% paths=ARCH.md,CHANGELOG.md,README.md,bun.lock(+23)
2026-11-21T03:46:50Z s=19560c1d FINDING package.json/bun.lock defuss-dbsonl 0.9.0 (+ esbuild 0.28.2), README.md, docs/SOURCES.md, docs/API.md, src/database.ts PAGE_CACHE comment, ARCH.md, CHANGELOG.md, website/index.html comparison paragraph, scripts/check-site.mjs claim guard, scripts/mongo-report.mjs warm-cache check, docs/benchmarks/*.json, docs/PERFORMANCE.md, docs/VALIDATION.md, rebuilt docs/guides/*.html, docs/index.html, docs/demo/*.js learn=test: scripts/check-site.mjs guards the copy; scripts/mongo-report.mjs encodes the format 5 warm-cache case; .vae/MEMORY.md background-bench line
2026-11-21T04:15:50Z s=19560c1d FAIL tests.e2e.1,docs.performance-evidence
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
