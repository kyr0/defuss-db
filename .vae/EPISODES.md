# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-11-19T18:11:49Z s=19560c1d FAIL prose
2026-11-19T18:38:34Z s=19560c1d FAIL env.example
2026-11-19T22:12:27Z s=19560c1d DONE fp=72814822e6f1 cov=93.8% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+65)
2026-11-19T22:12:27Z s=19560c1d FINDING src/scope.ts:TransactionScope.finish learn=test: tests/database.test.ts 'never commits part of a failed write started after the transaction callback returned' fails without the fix (mutation run) and passes wi
2026-11-19T22:12:27Z s=19560c1d FINDING src/database.ts:Database.import + src/archive.ts:releaseImport learn=test: tests/archive.test.ts 'closes an archive input that an import rejects before reading it' fails without the fix (mutation run) and passes with it, on a real file
2026-11-19T22:12:27Z s=19560c1d FINDING scripts/site-evidence.mjs:operationTable learn=verifier: scripts/check-site.mjs asserts no unrendered pipe table in any guide (runs in make site and make e2e)
2026-11-19T22:12:27Z s=19560c1d FINDING Makefile:recipes learn=verifier: rule make.pinned-tools forbids bare bun/node recipe lines; assertPinnedRuntime in scripts/workload-report.mjs rejects reports from unpinned runtimes
2026-11-19T22:12:27Z s=19560c1d FINDING scripts/serve-site.mjs learn=none: observability fix (error handler exits 1 with an ISO-8601 ERROR line, SIGTERM closes cleanly), observed via make start/status/stop/log; no rule kind expresses i
2026-11-19T22:12:27Z s=19560c1d FINDING scripts/bench-mongo.mjs:transaction probe learn=memory: .vae/MEMORY.md line mongodb 9.0.8 standalone
2026-11-19T22:12:27Z s=19560c1d FINDING website/index.html + docs/VALIDATION.md flush claims learn=memory: .vae/MEMORY.md flush@macOS line; scripts/mongo-report.mjs marks Bun-on-darwin write ratios not comparable
2026-11-19T22:12:27Z s=19560c1d FINDING src/mutations.ts:putDocument + src/schema-cache.ts (first write to a new collection) learn=test: tests/database.test.ts 'accepts concurrent first writes to a new collection and lists, verifies and exports it' fails with the old s: write restored (mutation r
2026-11-19T22:16:53Z s=19560c1d DONE fp=43c31ca48bd8 cov=93.8% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+65)
2026-11-19T23:43:22Z s=19560c1d DONE fp=4bb9e129552b cov=93.9% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+69)
2026-11-19T23:43:22Z s=19560c1d FINDING src/database.ts:Database (no compaction policy) learn=test: tests/compaction.test.ts bound and idle tests fail with escalation or the idle trigger removed (mutation runs)
2026-11-19T23:43:22Z s=19560c1d FINDING src/compaction.ts:AutoCompactor.committed learn=memory: exclusive vs optimistic mode is not observable through the public API; no test can tell them apart without instrumentation
2026-11-19T23:43:22Z s=19560c1d FINDING src/compaction.ts:AutoCompactor.run (idle CONFLICT) learn=memory: needs two processes and a sustained writer; timing-dependent, no deterministic test
2026-11-19T23:43:22Z s=19560c1d FINDING src/database.ts:Database.compact learn=test: tests/compaction.test.ts 'does not copy the store again after a manual compaction' fails without the call (mutation run)
2026-11-19T23:43:22Z s=19560c1d FINDING scripts/bench-mongo.mjs:compare learn=memory: .vae/MEMORY.md VERIFIED[bench fairness]
2026-11-19T23:43:22Z s=19560c1d FINDING src/ARCH.md:15, tests/ARCH.md:7,13,15 learn=memory: MEMORY VERIFIED[versions] already records the rule; a regex rule would also match legitimate dependency versions
2026-11-20T00:12:34Z s=19560c1d DONE fp=9357d7d171f4 cov=93.9% paths=AGENTS.md,ARCH.md,CHANGELOG.md,Makefile(+73)
2026-11-20T00:12:34Z s=19560c1d FINDING src/database.ts:openDatabase (page cache) learn=memory: a test may not pin a config value (AGENTS.md); the rationale and numbers are in ARCH.md 'Read costs' and the PAGE_CACHE comment
2026-11-20T00:12:34Z s=19560c1d FINDING src/query.ts:measuredOptions learn=test: tests/measured.test.ts checks one measurement per source row and direct measurement for any other row
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
