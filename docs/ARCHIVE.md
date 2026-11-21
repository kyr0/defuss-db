# Brotli import and export

`export({history:'full'})` and its streaming equivalent write manifest 3, which records source lineage, history coverage, original DBSONL commit receipts and schema events. A full restore validates and rebuilds historical projections atomically in an empty target. Default exports write manifest 2 with current documents and ordinary index definitions. [Full backup and restore](HISTORY.md)


`Database.export()`, `Database.exportStream()` and `Database.import()` use **defuss-brotli 0.3.0** and binary defuss-dson. Explicit snapshots also expose both export methods. The portable archive contains collection schemas and documents; equality, ordered and lexical/vector/hybrid indexes are rebuilt on import. Native values, cycles and shared references **within a document** retain DSON semantics. No embedding model or custom analyzer function is serialized.

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { openDirectory } from 'defuss-db/server';

const source = await openDirectory('./source');
await pipeline(source.exportStream({ quality: 4 }), createWriteStream('backup.dfdb.br'));
await source.close();

const target = await openDirectory('./restored');
const receipt = await target.import(createReadStream('backup.dfdb.br'));
console.log(receipt.imported, receipt.sourceRevision, receipt.revision);
await target.verify();
await target.close();
```

Browser workers use the same archive API on `openOPFS()` handles:

```ts
const bytes = await db.export({ collections: ['documents'], quality: 4 });
// Store/download bytes as application/octet-stream, or pass a Blob/File stream directly.
await restored.import(new Blob([bytes]).stream());
```

The byte-array method copies import input synchronously before its first await. Stream chunks are copied when pulled, so a producer may reuse a buffer after its next pull. Accepted import inputs: `Uint8Array`, synchronous/asynchronous iterables of byte arrays, and `ReadableStream<Uint8Array>`.

## Consistency and conflicts

- Export holds one read snapshot from its first pull until completion, cancellation, error or `iterator.return()`. A later write or compaction does not change its contents. For a snapshot selected earlier, call `snapshot.export()` or `snapshot.exportStream()`. Close explicit snapshots yourself.
- Default import requires an empty database, apart from its format marker. **The entire archive is one transaction.** No document or schema becomes visible before the terminal frame, counts, indexes and commit validation succeed. Aborts, producer errors, duplicate keys, malformed data, capacity errors and concurrent conflicts roll back everything.
- `mode: 'merge'` permits an existing database, preserves unrelated collections and requires matching schemas for overlapping collections. `conflicts: 'error'` (default), `'skip'`, or `'replace'` govern duplicate **primary** keys. Unique secondary-index constraints remain enforced for every policy. `replace` replaces a whole document; it does not clear the collection or database.
- Index rebuilding generates new search generations and the target has its own revision history. `sourceRevision` is provenance, not a request to set the target revision. Import callbacks are not silently retried; a consumed stream may not be replayable.

## Limits and memory

| Option | Default | Scope |
| --- | ---: | --- |
| `quality` | 4 | Export; integer 0–11 |
| `blockBytes` | 1 MiB | Export target block size; minimum 1 KiB |
| `maxFrameBytes` | 32 MiB | Both compressed and decoded frame sizes; configurable 1 KiB–256 MiB |
| `maxArchiveBytes` | 1 GiB | Streaming export/import total compressed bytes |
| buffered `export().maxArchiveBytes` | 64 MiB | Buffered export total compressed bytes |
| `maxDecodedBytes` | 1 GiB | Import total uncompressed frame bytes |
| `maxDocuments` | 1,000,000 | Both directions |
| `maxCollections` | 10,000 | Both directions |

All methods accept `signal`. Export additionally accepts a unique list of existing collection names. Import also honors the target's DBSONL record, transaction-byte and transaction-operation limits, including derived index writes. Raise those limits explicitly for larger atomic imports.

Streaming avoids assembling the whole archive in memory. It does **not** make transaction staging constant-space: import retains staged writes until commit. Export holds bounded encoded blocks plus a bounded native scan batch; object heap size can exceed encoded size. Import also holds the producer's current chunk. Buffered export retains all compressed chunks and allocates the final joined array. A single large document may exceed `blockBytes` but must fit `maxFrameBytes`, including its archive envelope. Very large datasets should use appropriately sized budgets or application-level collection archives; no partial-commit import mode is implied.

## Physical framing, version 1

The file starts with eight bytes `44 46 44 42 42 52 01 00` (`DFDBBR`, version 1, reserved zero). Each frame has a 44-byte header:

| Offset | Field |
| ---: | --- |
| 0 | sequence number, unsigned 32-bit little-endian, beginning at zero |
| 4 | uncompressed payload length, unsigned 32-bit little-endian |
| 8 | compressed payload length, unsigned 32-bit little-endian |
| 12 | 32-byte SHA-256 digest |

The digest covers `previousDigest || first12HeaderBytes || compressedPayload`, starting with a zero-filled previous digest. Payloads are independent Brotli streams. Each decoded payload contains length-prefixed binary DSON records (`u32le length`, followed by the record bytes); records do not cross frame boundaries.

Latest-only archives use logical manifest 2 and a full-history archive uses manifest 3; import rejects any other manifest. Export copies logical documents and index definitions. Import preserves the target store UUID, creates or updates collection revision markers transactionally, and rebuilds new collections' equality, ordered and search indexes.

Records begin with a manifest, then sorted unique collection schemas, documents sorted by `(collection, encodedPrimaryKey)`, and an end record with counts. A final zero-length frame with a valid chained digest is mandatory, followed immediately by EOF. Missing/reordered frames, trailing bytes and count mismatches are rejected. Length caps are checked before frame allocation/decompression, and the decoder's `maxOutputSize` is set to the declared bounded length.

Checksums detect accidental corruption. They are **not authentication, signatures or encryption**. The archive is a framed container, not one standalone `.br` stream; use `db.import()`, not a generic whole-file Brotli decoder.

## Runtime and deployment

Compression/decompression modules initialize lazily. ESM and CommonJS consumers both load the actual package with dynamic import. The standard upstream distribution embeds its WASM, so no separate WASM asset URL is required. Browser bundling can still include that embedded payload; this release does not promise a small archive-enabled bundle.

Browser CSP must permit WASM compilation, e.g. `script-src 'self' 'wasm-unsafe-eval'`; JavaScript `unsafe-eval` is not required. OPFS still requires an appropriate secure worker context. Compression is synchronous within each block and can occupy its worker/event loop; use a dedicated worker for interactive applications. Multithreaded compression and background snapshot scheduling are not part of this API.

A full archive restores immutable history and source receipts into an empty target. Use a source-qualified revision to reproduce an earlier recorded answer after restore. [Full backup and restore](HISTORY.md)
