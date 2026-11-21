# Website sources

`index.html` is the landing template; `scripts/site.mjs` renders it into `docs/index.html` with the benchmark data, the MongoDB comparison charts and the code examples, and renders the Markdown guides. `make dev` serves the generated `docs/` directory, and a static web server can serve it from a subdirectory. The website includes local fonts, the selected defuss-shadcn 0.9.14 components, ECharts and their notices in `docs/assets/vendor/`; the npm package excludes website assets.

The code shown on the page lives in `examples/`. `make lint` typechecks the TypeScript files against `src/`, and `scripts/site.mjs` highlights them at build time, so the page cannot show code that does not compile. Setup installs the package from npm.

The comparison charts draw the medians in `docs/benchmarks/mongodb-*.json`. `scripts/check-site.mjs` checks that the data embedded in the page equals `mongoChartData()` of those reports, and that every claim in the comparison and scale sections still holds for them. Why two charts beat one table: VERIFIED: the medians span 0.015 ms to 4.5 s, so one shared axis would hide the short operations; the first chart shows relative speed on a log2 scale, the second each operation on its own linear scale.

`demo/` holds Ledger, the playground the landing page embeds in a same-origin frame; its own [ARCH.md](demo/ARCH.md) covers its design. The frame loads lazily, because the first visit writes about 120 MB to the browser's origin private file system (VERIFIED: 113.1 MiB committed after the seed, shown in the playground's header). The frame follows the site's theme through the storage event, so the landing page needs no protocol for it.
