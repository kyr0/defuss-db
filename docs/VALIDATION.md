# Validation

The release suite ran on Linux x64 on 2026-11-18 and on macOS arm64 (Apple M5 Max) on 2026-11-19, both with Node.js 26.13.1 and Bun 1.4.4. Reports in `output/` retain exact counts, coverage, versions, timings and execution dates.

| Check | Evidence |
| --- | --- |
| Unit/integration requirements | 133 tests using real memory and native file storage |
| Temporal invariants | Native commit receipts after a disjoint commit, ordinal ordering, half-open intervals, historical predicate writes, tombstones, snapshot visibility, stable cursors and historical BM25/vector/hybrid scores against a rebuilt reference corpus. The deterministic cell oracle compares 1,152 recorded/effective observations. |
| Temporal storage | Interruption and resumption across handles, baseline publication under tight transaction limits, failure rollback, archive lineage through two forks, zero-payload tombstones and one-seek point reads across a 256-version timeline. |
| Packed history | Node and Bun directory reopen after compaction, real Chromium OPFS reopen, and full history archives crossing between server and OPFS with source-qualified receipts. |
| Index-only reads | A storage probe records zero document lookups for ID pages and range counts. Tests compare all outputs against full rows, including mixed primary types, ties, bounds, snapshots and staged changes. |
| Website pages | Every generated page loads in Chromium at desktop and phone width without console errors, failed requests or horizontal overflow. The landing page benchmark controls, charts, theme, tabs, menu and embedded playground run through their buttons. `scripts/e2e-demo.mjs` drives every tab of the Ledger playground at both widths, including persistence across a reload. |
| Browser examples | 18 Chromium checks run seven examples against the installed tarball. Eight price-history cases vary the effective date and recorded revision. They exercise cursor resume, grouping, snapshots and rejected writes, all three search modes, compressed native graphs, and persisted OPFS state. |
| Seek and ordering | Pairwise DataView comparator oracle, forced scan equivalence, 128/129 range cutoff, mixed directions, prefix IDs, exact key limit, explicit bounds, malformed and stale cursors, pinned snapshots, compaction and rollback. A seven-row deep continuation reads seven documents plus one lookahead pointer. |
| Caching and indexing | Cross-handle writes, independent collections, same-collection replacement, skipped import, current summary revisions, query/search plan equivalence, rejected writes and corruption detection. |
| Query correctness | Indexed/forced-scan/JavaScript equivalence across four batch sizes; DataView array-source aggregation oracle |
| Search semantics | Upstream lexical/vector/hybrid oracles; pre-top-k predicates/typed IDs; language analyzers; TurboQuant refinement; cached generations; rollback/reopen/compaction; concurrent search-write conflicts |
| Brotli archives | Native DSON graphs, all index definitions, merge policies, fragmented/reused Node buffers, size limits, checksum/order/truncation failures and full rollback |
| Archive interoperability | Archives travel from Node and Bun to Chromium OPFS and back; packed ESM/CommonJS archive consumers |
| Query cache | Automatic/manual admission, revision/handle/snapshot isolation, transaction bypass, plan reuse/bounds/immutability, exact property order, native-constant bypass, result ownership, one real scan for eight overlapping queries, budget/signal isolation, shared failure cleanup and clear epochs |
| Input capture / I/O | Synchronous argument capture, one schema read for 100-document indexed batch, one document read per update, one schema read per collection audit, zero equality-index writes for unchanged fields, bounded point reads |
| Native types | Dates, invalid Dates, bigint, undefined, NaN/infinity, signed zero, binary views, shared buffers, Maps, Sets, RegExp, shared references and cycles |
| Transactions | Cross-collection commit/rollback, staged reads, conflicting uniqueness, phantom detection, disjoint point writes, callback lifecycle, capacity failure |
| Recovery | Four separately launched writer SIGKILL trials; reopen, paired-document, equality-index, ordered-index and hybrid-search input atomicity/audit after each |
| Runtime concurrency | Independent Node and Bun processes updating one real directory without lost updates |
| Native packaging | Clean tarball consumers under Node and Bun, ESM and CommonJS, including directory operations |
| Type packaging | Clean TypeScript consumer checks projected aliases, aggregate result types and rejected unknown fields without DOM/Node ambient types |
| Browser packaging | Browser bundle built from installed tarball; excludes native locking/server, ONNX/transformer and multicore imports |
| Browser execution | Real Chromium Headless Shell 153.0.8010.12, dedicated workers and OPFS. 8 scenarios with 62 assertions |
| Browser concurrency | Two independent workers perform 24 total counter updates, then a fresh worker checks persisted state and index integrity |
| Resource behavior | Row/work/output/group limits, cancellation, early iterator return, pull-driven ingestion receipts |

The browser test ran under a same-origin CSP on localhost with `script-src 'self' 'wasm-unsafe-eval'` for Brotli WASM, without JavaScript `unsafe-eval`. The execution environment required the serverless headless shell with single-process browser mode; it still uses real dedicated workers, OPFS and Web Locks. This validates competing workers, not separate browser processes. The release's e2e script also supports a normal Playwright browser. Browser launch arguments are recorded in `output/e2e-results.json`.

Coverage is measured by the Node integration suite; it does not fabricate browser coverage. The final run measured 92.99% line coverage and 87.69% branch coverage. The exact values are in `output/coverage/coverage-summary.json`. TypeScript checks and oxlint run with warnings treated as failures.

Not established by these runs: physical power loss, disk-full fault injection, Windows native execution, Firefox/WebKit OPFS behavior, network filesystems, hostile writers, multi-origin browser storage, or distributed use. On macOS a 4 KiB write plus defuss-storage flush took about 4 ms under Node.js and under Bun ([MongoDB comparison](PERFORMANCE.md#compared-with-mongodb-on-one-machine)): under both runtimes it asks the drive to empty its write cache (`F_FULLFSYNC`). Server and browser durability differ as reported by their backends. SIGKILL tests establish process-interruption behavior for exercised timings, not an exhaustive crash-point proof.

`make verify` runs the complete release gate. `make release` depends on that gate, then creates the archive with a fresh filename and per-file SHA-256 inventory. Release packaging compares query access paths within each backend, measures search and history, and compares DataView arrays only with in-memory collections, rebuilds the static site from the matching evidence and confirms the downloadable tarball matches the distributed package.
