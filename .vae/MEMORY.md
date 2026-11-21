# Agent memory

<!-- One tagged line per durable fact NOT derivable from code, git or docs:
- VERIFIED[scope] fact BC evidence
- HYPOTHESIS[scope] claim BC observation; falsifier=`cmd`
- UNKNOWN[scope] gap BC missing evidence
[scope] = the narrowest path|module|command|condition the evidence covers, not a topic: the entry decides nothing
outside it, and recurrence inside one subsystem never widens it.
Every line carries its BC and stays within 240 chars. Replace stale lines instead of appending.
Mechanizable lessons belong in tests or .vae/VERIFY.py.
Budget 4 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[website positioning] human SAYS: in-browser and server-side alternative to MongoDB; isomorphic; strong guarantees; scales on one host; never federates (no replication|sharding|clustering) BC request 2026-11-19
- VERIFIED[Makefile@GNU Make 3.81 macOS] simple recipe lines exec via make's original PATH, not the exported one: bare `bun` ran Homebrew 1.4.3 BC probe 2026-11-19; recipes use $(BUN)/$(NODE) (rule make.pinned-tools)
- VERIFIED[flush@macOS arm64, defuss-storage 0.4.1] a defuss-storage flush is F_FULLFSYNC under Node and Bun (4.2 / 4.9 ms per 4 KiB); node:fs `sync()` under Bun stays a plain fsync (0.05 ms), so flush probes must go through defuss-storage BC probe 2026-11-20, scripts/bench-mongo.mjs flushProbe
- VERIFIED[mongodb 9.0.8 standalone@127.0.0.1] driver withTransaction fails with a retryable-writes message; the raw command shows the server's IllegalOperation BC scripts/bench-mongo.mjs probe
- VERIFIED[versions] human SAYS: nothing released after 2.0.2; 3.x to 6.x labels were agent-invented development versions; no backward compatibility with any earlier store or package; next release is 3.0.0 BC request 2026-11-19
- VERIFIED[storage space@defuss-dbsonl 0.6.0-0.7.0] commits never reuse file space; a 100k load with a random ordered index appends ~11x live bytes, and fragmented stores read 2-24x slower; src/compaction.ts compacts (idle: 1.5x live or 2x last packed, non-blocking; bound 4x exclusive) BC scratchpad probes 2026-11-20, tests/compaction.test.ts
- VERIFIED[bench fairness] any defuss-db benchmark must wait until db.stats().autoCompaction.state is idle|off right after its own writes, before timing anything else, or background copies overlap the next measurement BC bench-mongo 2026-11-20
- VERIFIED[scan pool@defuss-dbsonl 0.7.0] scanBatches with `sizeOf` never runs in dbsonl's worker pool; defuss-db scans through src/batches.ts (no sizeOf, bounded 4,096-row first scan) and measures rows itself BC dbsonl store source, A/B 0 vs 4 workers 2026-11-20
- VERIFIED[write cost@defuss-dbsonl 0.7.0] per commit, every touched leaf and branch is rewritten: an insert of 64 bench documents (1 index) rewrites 148 pages = 823 KiB for 13 KiB of documents, a 256 batch 327 pages = 2 MiB (32x); a leaf entry is ~132 B + 2x key chars (field names per entry, UTF-16 keys, float64 numbers; defuss-db index keys are 64 chars); costs per 64 insert: fsync ~3.5 ms, page encode ~2.2 ms, page-cache eviction ~1.4 ms (fixed in ~/Code/json-dbjsonl working tree, unreleased: insert 64 9.3→7.0-7.8 ms), defuss-db ~0.7 ms; the 32x growth hits the 4x compaction bound every ~36 commits of a load and the exclusive copy blocks writers (about half or more of a load) BC scratchpad overlay probes 2026-11-20; NOT the cause: value decode/re-encode in compact
- VERIFIED[defuss-dbsonl 0.8.0, published 2026-11-21] format 4 compact pages + one-pass cache eviction; defuss-db pins it. 100k load with one scattered index: 3.7-3.9x growth without compaction (0.7: 11.5x); src/compaction.ts estimates live bytes as packed x entries/entries-at-pack (count read BEFORE the copy; a count read after included queued writers' entries and caused a second copy), so the load copies once: 4.4-4.9 s vs 9.7 s with the packed-size bound; a warm cache holds ~2 KiB heap per page BC scratchpad probes 2026-11-21, tests/compaction.test.ts
