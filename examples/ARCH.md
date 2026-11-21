# Examples

The server example uses an isolated directory under output/ and idempotent primary-key puts. The browser pair demonstrates the required dedicated-worker boundary and structured-clone responses to the main thread. Application authentication, UI and automatic retry policy remain application decisions. Example messages are serialized transactions; production clients should avoid overlapping operations on one callback scope and handle CONFLICT explicitly.

`search.ts` demonstrates a persistent hybrid index, application-supplied typed-array embeddings, DataView filtering and RRF fusion. The dimension-3 fixture is illustrative; no model inference runs.

`archive.ts` streams a portable Brotli archive from a native directory into a file and restores it with an explicit merge/replace policy, then audits the target.

`ordered.ts` walks a pinned per-tenant feed across a tied descending Date. Run `bun examples/ordered.ts` after building.
