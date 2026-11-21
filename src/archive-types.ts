export type ArchiveInput =
  | Uint8Array
  | Iterable<Uint8Array>
  | AsyncIterable<Uint8Array>
  | ReadableStream<Uint8Array>;
export interface ExportOptions {
  /** Latest archives carry current documents and index definitions. Full history restores to an empty target. */
  history?: 'latest' | 'full';
  maxHistoryRecords?: number;
  collections?: readonly string[];
  /** Brotli quality 0..11, default 4. */
  quality?: number;
  /** Compression blocks target this size; an individual record may use maxFrameBytes. Default 1 MiB. */
  blockBytes?: number;
  /** Maximum compressed/uncompressed frame; default 32 MiB. */
  maxFrameBytes?: number;
  /** Default 1 GiB for streaming, 64 MiB for buffered export(). */
  maxArchiveBytes?: number;
  maxDocuments?: number;
  maxCollections?: number;
  signal?: AbortSignal;
}
export interface ImportOptions {
  maxHistoryRecords?: number;
  /** Empty requires an empty target. Merge preserves unrelated collections and requires matching schemas. */
  mode?: 'empty' | 'merge';
  conflicts?: 'error' | 'replace' | 'skip';
  maxFrameBytes?: number;
  maxArchiveBytes?: number;
  maxDecodedBytes?: number;
  maxDocuments?: number;
  maxCollections?: number;
  signal?: AbortSignal;
}
export interface ImportResult {
  imported: number;
  skipped: number;
  collections: number;
  sourceRevision: number;
  revision: number;
  storedEntries: number;
}
