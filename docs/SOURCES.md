# Upstream provenance

Source inspection used these GitHub revisions on 2026-11-17:

| Package | Source manifest version | Revision |
| --- | --- | --- |
| defuss-dataview | 0.6.0 | [`3c1ae222b863`](https://github.com/kyr0/defuss-dataview/tree/3c1ae222b863b83afa26e97f61581cfb701251c2) |
| defuss-dbsonl | 0.6.0 | [`1b1e7a7ce1a6`](https://github.com/kyr0/defuss-dbjsonl/tree/1b1e7a7ce1a62112a219092d4cc519ea6c99da7e) |
| defuss-storage | 0.3.1 | [`3fff26113662`](https://github.com/kyr0/defuss-storage/tree/3fff26113662ecc49ca21dc4f75ff66d0473d23b) |
| defuss-dson | 1.5.0 | [`4a6a3af645ac`](https://github.com/kyr0/defuss-dson/tree/4a6a3af645acd10233139c75c59a61d59c3a1c4c) |

Runtime dependencies are pinned to published defuss-dataview 0.7.0, defuss-dbsonl 0.9.0, defuss-storage 0.4.1 and defuss-dson 1.5.1. The DSON source repository inspected reported 1.5.0; the installed and tested runtime is 1.5.1, required by DBSONL. `bun.lock` records resolved transitive versions and integrity hashes. The repository named `defuss-dbjsonl` publishes the binary package `defuss-dbsonl`.

Search integrations inspected and pinned on 2026-11-17:

| Package | Version | Git revision |
| --- | --- | --- |
| defuss-lexicalsearch | 0.4.0 | [`03c142d26107`](https://github.com/kyr0/defuss-lexicalsearch/tree/03c142d261074a2d112a61798eb674f4838457dc) |
| defuss-vectorsearch | 0.4.0 | [`cd344849ca6d`](https://github.com/kyr0/defuss-vectorsearch/tree/cd344849ca6d43c4bfceaac3a6cb8a5e828b8f90) |
| defuss-search | 0.5.0 | [`1b88fba4ec69`](https://github.com/kyr0/defuss-search/tree/1b88fba4ec69a030477b9eda4d861eaae0761088) |

Compression uses the installed/pinned [defuss-brotli 0.3.0 published package](https://www.npmjs.com/package/defuss-brotli/v/0.3.0), including its compressor/decompressor declarations and embedded WASM. The monorepo `packages/brotli/package.json` inspected reported 0.1.3, so that source version is not presented as the tested runtime. `bun.lock` records the published artifact integrity. The archive API exercises quality selection and the decompressor's `maxOutputSize` limit in Node, Bun and Chromium.

## Temporal semantics

Defuss-db uses an effective date and a recorded revision. Each date-targeted correction extends to the next effective boundary for that document unless an earlier exclusive end is supplied. [XTDB time dimensions](https://docs.xtdb.com/concepts/key-concepts.html) · [MariaDB application-time periods](https://mariadb.com/docs/server/reference/sql-structure/temporal-tables/application-time-periods) · [Datomic database filters](https://docs.datomic.com/reference/filters.html)

## Website

The site uses defuss-shadcn components, local fonts and licensed ECharts assets. The binary distribution lists its pinned packages in the manifest. [Reference template](https://github.com/kyr0/defuss-dbsonl/blob/main/docs/index.html) · [VAE prose reference](https://github.com/kyr0/defuss-vae/blob/main/plugin/references/PROSE.md)
