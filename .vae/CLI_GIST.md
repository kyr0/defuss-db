# CLI gist

<!-- Commands future agents need that the Makefile verbs do not cover (setup, env, data, deploy):
- VERIFIED[purpose] `cmd`: only after an observed success
- UNKNOWN[purpose] BC gap
Budget 2 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[mongo comparison] `make bench-mongo` (MONGODB_URL in .env; creates and drops a throwaway database), then `node scripts/site-evidence.mjs && make site` to publish
- VERIFIED[site] `make start` serves docs/ on PORT (default 4380); `make e2e-site` drives every page in Chromium
