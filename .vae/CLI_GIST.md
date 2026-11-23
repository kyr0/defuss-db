# CLI gist

<!-- Commands future agents need that the Makefile verbs do not cover (setup, env, data, deploy):
- VERIFIED[purpose] `cmd`: only after an observed success
- UNKNOWN[purpose] BC gap
Budget 2 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[publish benchmarks] `make bench-runs` (8 runs, ~25 min; MONGODB_URL in .env; creates and drops a throwaway database), then `make verify && node scripts/site-evidence.mjs && make site`; a single `make bench-mongo|bench-workloads` run is not publishable (loaders require the merged runs)
- VERIFIED[site] `make start` serves docs/ on PORT (default 4380); `make e2e-site` drives every page in Chromium
