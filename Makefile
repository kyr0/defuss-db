SHELL := /bin/bash
.DEFAULT_GOAL := help
-include .env
export
# The pinned Node and Bun from mise.toml precede any global install: engines require Bun >=1.4.4, and a global
# Homebrew Bun 1.4.3 would otherwise run every recipe. Without mise, PATH stays as it is.
MISE := $(or $(shell command -v mise 2>/dev/null),$(wildcard $(HOME)/.local/bin/mise))
MISE_BIN := $(if $(MISE),$(shell $(MISE) bin-paths 2>/dev/null | paste -sd: -))
ifneq ($(MISE_BIN),)
export PATH := $(MISE_BIN):$(PATH)
endif
# GNU Make 3.81 (macOS) execs a simple recipe line through its original PATH, so the exported PATH alone would still
# run the global Bun; absolute paths make every recipe use the pinned tools.
BUN  := $(or $(shell PATH='$(PATH)' command -v bun),bun)
NODE := $(or $(shell PATH='$(PATH)' command -v node),node)
# Service: the generated static site in docs/, served on PORT (default 4380).
NAME  ?= site
N     ?= 50
LOG    = var/log/$(NAME)
PID    = tmp/$(NAME).pid
ALIVE  = [ -f $(PID) ] && kill -0 "$$(cat $(PID))" 2>/dev/null
.PHONY: help setup build lint test coverage e2e e2e-package e2e-site verify start stop restart status log metrics \
	bench bench-workloads bench-history bench-mongo bench-search site site-check dev release clean example

help: ## list the verbs with their usage
	@awk -F':.*## ' '/^[a-zA-Z0-9_ -]+:.*## /{printf "  %-16s %s\n", $$1, $$2}' $(firstword $(MAKEFILE_LIST))

setup: ## install pinned tools (mise.toml), locked dependencies and the Playwright Chromium shell
	@if command -v mise >/dev/null 2>&1; then mise install; fi
	$(BUN) install --frozen-lockfile
	$(BUN) x playwright install --only-shell chromium
build: ## build dist/ with pkgroll
	$(BUN) run build
lint: build ## typecheck and oxlint (warnings fail), then typecheck the website's code examples
	$(BUN) run lint
	$(NODE) node_modules/typescript/bin/tsc -p website/examples
test: build ## run the vitest suite against real memory and directory stores
	$(BUN) run test
coverage: build ## run the suite with v8 coverage (output/coverage)
	$(BUN) run coverage
e2e: e2e-package e2e-site ## consume the packed tarball in Node, Bun and Chromium, then drive every site page
e2e-package: build
	$(BUN) run e2e
e2e-site: site
	$(NODE) scripts/e2e-site.mjs
	$(NODE) scripts/e2e-demo.mjs
verify: lint test coverage e2e ## what CI runs: every gate verb, cheapest first

start: ## serve docs/ detached on PORT (default 4380): pid in tmp/, logs in var/log/
	@mkdir -p var/log tmp
	@if $(ALIVE); then echo "running pid=$$(cat $(PID))"; exit 0; fi; \
	set -m; nohup $(NODE) scripts/serve-site.mjs >>$(LOG).stdout 2>>$(LOG).stderr </dev/null & set +m; \
	echo $$! >$(PID); sleep 1; \
	if $(ALIVE); then echo "running pid=$$(cat $(PID))"; else echo "dead; see: make log"; exit 1; fi
stop: ## SIGTERM the site server, SIGKILL after 5 s
	@if $(ALIVE); then p=$$(cat $(PID)); kill -s TERM -- -$$p 2>/dev/null || kill -s TERM $$p; \
	i=0; while kill -0 $$p 2>/dev/null && [ $$i -lt 50 ]; do sleep 0.1; i=$$((i+1)); done; \
	kill -s KILL -- -$$p 2>/dev/null || true; fi; rm -f $(PID); echo stopped
restart: stop start ## stop, then start
status: ## running | dead (stale pid) | stopped, as LSB exit codes 0 | 1 | 3
	@if $(ALIVE); then echo "running pid=$$(cat $(PID))"; \
	elif [ -f $(PID) ]; then echo "dead pid=$$(cat $(PID)); see: make log"; exit 1; \
	else echo stopped; exit 3; fi
log: ## tail the site server logs (N=50 lines)
	@for f in $(LOG).stdout $(LOG).stderr; do [ -f $$f ] && { echo "== $$f"; tail -n $(N) $$f; }; done; \
	ls $(LOG).* >/dev/null 2>&1 || echo "∅ no logs for $(NAME)"
metrics: build ## print dist and packed sizes, plus the last coverage and test totals
	@$(NODE) scripts/metrics.mjs

bench: build ## quick single-runtime benchmark of the current build (output/benchmark.json)
	$(BUN) run bench
bench-workloads bench-history: build ## measure the published workloads under Node and Bun (output/workloads-*.json)
	$(BUN) run bench:history
bench-mongo: build ## compare defuss-db with the MongoDB at MONGODB_URL under Node and Bun (output/mongodb-*.json)
	$(NODE) scripts/bench-mongo.mjs
	$(BUN) scripts/bench-mongo.mjs
bench-search: build
	$(BUN) run bench:search

site: build ## render docs/ from website/, docs/*.md and docs/benchmarks, then check every link
	mkdir -p output
	$(BUN) pm pack --destination output >/dev/null
	$(NODE) scripts/site.mjs
	$(NODE) scripts/demo-build.mjs
	$(NODE) scripts/api-docs.mjs
	$(NODE) scripts/check-site.mjs
site-check:
	$(NODE) scripts/check-site.mjs
dev: site ## build the site, then serve it in the foreground
	$(NODE) scripts/serve-site.mjs
release: verify
	$(BUN) run bench:history
	$(NODE) scripts/site-evidence.mjs
	$(MAKE) site
	$(NODE) scripts/release.mjs
example: build
	$(BUN) examples/server.ts
clean:
	rm -rf dist output
