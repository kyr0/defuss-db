import {
  CLOCK,
  activationKey,
  checkedClock,
  events,
  fence,
  heads,
  lineage,
  parseEvent,
  parseFact,
  projectBoundary,
  projectAudit,
  touchHistory,
  verifyTimeline,
  type Origins,
  type Fact,
  type SchemaEvent,
} from './history-store.js';
import { storeIdentity } from './format.js';
import { encode, decode } from 'defuss-dson/binary';
import { DatabaseError } from './errors.js';
import {
  assertDocument,
  documentKey,
  documentPrefix,
  FORMAT_KEY,
  collectionName,
  range,
  readSchema,
  schemaKey,
} from './keys.js';
import { putDocument, createIndex } from './mutations.js';
import { createSearchIndex } from './search-mutations.js';
import { saveSchema } from './schema-cache.js';
import { versionKey } from './collection-version.js';
import { COLLECTIONS, entryKey, importEntry, readEntry } from './catalog.js';
import type { Reader, SnapshotLease, Writer, Schema, Document } from './types.js';
import type { ArchiveInput, ExportOptions, ImportOptions } from './archive-types.js';

const MAGIC = new Uint8Array([68, 70, 68, 66, 66, 82, 1, 0]); // DFDBBR, version 1, reserved 0.
const HEADER = 44;
const MAX_FRAME = 32 * 1024 * 1024;
type RecordValue =
  | {
      type: 'manifest';
      format: 'defuss-db';
      version: 2 | 3;
      revision: number;
      storeId?: string;
      sources?: Origins;
      clock?: { ms: number; seq: number };
    }
  // `entry`: the collection's `_collections` document without its id; builds before 3.2 wrote none and skip it.
  | { type: 'schema'; collection: string; schema: Schema; entry?: Record<string, unknown> }
  | { type: 'document'; collection: string; document: Document }
  | { type: 'history'; collection: string; key: string; value: Fact | SchemaEvent }
  | { type: 'end'; documents: number; collections: number; historyRecords?: number };
function integer(value: number, label: string, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`${label} must be an integer in [${min}, ${max}].`);
  return value;
}
function abort(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
}
function corrupt(message: string): never {
  throw new DatabaseError('CORRUPT', `Archive: ${message}`);
}
function join(
  parts: readonly Uint8Array[],
  length = parts.reduce((n, part) => n + part.length, 0),
): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
async function digest(
  previous: Uint8Array,
  header: Uint8Array,
  payload: Uint8Array,
): Promise<Uint8Array> {
  return new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', join([previous, header, payload])),
  );
}
/** Lazy dynamic imports preserve the package's ESM-only exports in both our ESM and CommonJS builds. */
async function encoder() {
  const codec = await import('defuss-brotli/compressor');
  await codec.init();
  return codec;
}
async function decoder() {
  const codec = await import('defuss-brotli/decompressor');
  await codec.init();
  return codec;
}
function currentSchema(schema: Schema): Schema {
  const { history: _history, ...current } = schema;
  return {
    ...current,
    indexes: schema.indexes.map(({ temporalUnique: _constraint, ...index }) => index),
  };
}
function exportOptions(input: ExportOptions) {
  if (input.history !== undefined && !['full', 'latest'].includes(input.history))
    throw new TypeError('Invalid history export mode.');
  const maxFrameBytes = integer(
    input.maxFrameBytes ?? MAX_FRAME,
    'maxFrameBytes',
    1024,
    256 * 1024 * 1024,
  );
  const collections = input.collections === undefined ? undefined : [...input.collections].sort();
  if (collections) {
    collections.forEach(collectionName);
    if (new Set(collections).size !== collections.length)
      throw new TypeError('Duplicate export collections.');
  }
  return {
    ...input,
    collections,
    maxFrameBytes,
    quality: integer(input.quality ?? 4, 'quality', 0, 11),
    blockBytes: integer(input.blockBytes ?? 1024 * 1024, 'blockBytes', 1024, maxFrameBytes),
    maxArchiveBytes: integer(input.maxArchiveBytes ?? 1024 ** 3, 'maxArchiveBytes'),
    maxDocuments: integer(input.maxDocuments ?? 1_000_000, 'maxDocuments', 0),
    maxHistoryRecords: integer(input.maxHistoryRecords ?? 1000000, 'maxHistoryRecords', 0),
    maxCollections: integer(input.maxCollections ?? 10_000, 'maxCollections', 0),
  };
}
async function* logicalRecords(
  reader: Reader,
  options: ReturnType<typeof exportOptions>,
): AsyncGenerator<RecordValue> {
  const full = options.history === 'full';
  const storeId = full ? storeIdentity((await reader.get(FORMAT_KEY)).value) : '';
  if (full) {
    const sources: Origins = {};
    for await (const row of reader.scan(range('l:')))
      sources[row.key.slice(2)] = row.value as number;
    const clock = await reader.get(CLOCK);
    yield {
      type: 'manifest',
      format: 'defuss-db',
      version: 3,
      revision: reader.revision,
      storeId,
      sources,
      ...(clock.found ? { clock: checkedClock(clock.value) } : {}),
    };
  } else yield { type: 'manifest', format: 'defuss-db', version: 2, revision: reader.revision };
  function exportSchema(value: unknown) {
    const schema = readSchema(value);
    if (schema.activating && full)
      throw new DatabaseError(
        'HISTORY_ACTIVATING',
        'Finish the baseline before exporting full history.',
      );
    delete schema.activating;
    if (!full) return currentSchema(schema);
    return schema;
  }
  const entryOf = async (collection: string) => {
    const row = await reader.get(entryKey(collection));
    if (!row.found) return {};
    const { id: _id, ...entry } = readEntry(row.value);
    return { entry };
  };
  const collections: string[] = [];
  if (options.collections) {
    for (const collection of options.collections) {
      const row = await reader.get(schemaKey(collection));
      if (!row.found && !(await reader.get(versionKey(collection))).found)
        throw new DatabaseError('SCHEMA_MISMATCH', `Collection ${collection} does not exist.`);
      collections.push(collection);
      if (collections.length > options.maxCollections)
        throw new RangeError('Export collection limit exceeded.');
      yield {
        type: 'schema',
        collection,
        schema: exportSchema(row.value),
        ...(await entryOf(collection)),
      };
    }
  } else {
    // A collection without DDL has only its r: marker; its schema is the implicit default.
    const names = new Set<string>();
    for await (const row of reader.scan({ ...range('r:'), signal: options.signal }))
      names.add(row.key.slice(2));
    for await (const row of reader.scan({ ...range('s:'), signal: options.signal }))
      names.add(row.key.slice(2));
    // The catalog travels as the `entry` of each collection's schema record.
    names.delete(COLLECTIONS);
    for (const collection of [...names].sort()) {
      collectionName(collection);
      collections.push(collection);
      if (collections.length > options.maxCollections)
        throw new RangeError('Export collection limit exceeded.');
      yield {
        type: 'schema',
        collection,
        schema: exportSchema((await reader.get(schemaKey(collection))).value),
        ...(await entryOf(collection)),
      };
    }
  }
  let documents = 0;
  for (const collection of collections) {
    const scan = reader.scanBatches
      ? reader.scanBatches({
          ...range(documentPrefix(collection)),
          signal: options.signal,
          batchSize: 128,
          maxBatchBytes: options.maxFrameBytes,
        })
      : undefined;
    const emit = function* (batch: readonly { value: unknown }[]): Generator<RecordValue> {
      for (const row of batch) {
        if (++documents > options.maxDocuments)
          throw new RangeError('Export document limit exceeded.');
        assertDocument(row.value);
        yield { type: 'document', collection, document: row.value };
      }
    };
    if (scan) for await (const batch of scan) yield* emit(batch);
    else
      for await (const row of reader.scan({
        ...range(documentPrefix(collection)),
        signal: options.signal,
      }))
        yield* emit([row]);
  }
  let historyRecords = 0;
  if (full)
    for (const collection of collections) {
      const activation = await reader.get(activationKey(collection));
      for (const prefix of ['a:' + collection + ':', events(collection)]) {
        for await (const row of reader.scan({ ...range(prefix), signal: options.signal })) {
          if (++historyRecords > options.maxHistoryRecords)
            throw new RangeError('Export history record limit exceeded.');
          const f = row.value as Fact | SchemaEvent;
          const revision =
            'stagedSeed' in f && f.stagedSeed && !f.origins ? activation.revision! : row.revision;
          yield {
            type: 'history',
            collection,
            key: row.key,
            value: {
              ...f,
              origin: f.origin ?? storeId,
              origins: { ...f.origins, [storeId]: revision },
            },
          };
        }
      }
    }
  yield {
    type: 'end',
    documents,
    collections: collections.length,
    ...(full ? { historyRecords } : {}),
  };
}
/** Pull-driven block compression holds one snapshot until completion or iterator.return(). */
export function exportStream(
  open: () => Promise<SnapshotLease>,
  input: ExportOptions = {},
): AsyncGenerator<Uint8Array> {
  const options = exportOptions(input); // Capture options before the caller can mutate them.
  return (async function* () {
    abort(options.signal);
    const codec = await encoder(),
      lease = await open();
    let previous: Uint8Array = new Uint8Array(32),
      sequence = 0,
      total = MAGIC.length;
    const frame = async (raw?: Uint8Array) => {
      abort(options.signal);
      const payload = raw ? codec.compress(raw, { quality: options.quality }) : new Uint8Array();
      if (payload.length > options.maxFrameBytes)
        throw new RangeError('Compressed frame exceeds maxFrameBytes.');
      const header = new Uint8Array(HEADER),
        view = new DataView(header.buffer);
      view.setUint32(0, sequence++, true);
      view.setUint32(4, raw?.length ?? 0, true);
      view.setUint32(8, payload.length, true);
      previous = await digest(previous, header.subarray(0, 12), payload);
      header.set(previous, 12);
      const result = join([header, payload]);
      total += result.length;
      if (total > options.maxArchiveBytes)
        throw new RangeError('Export archive byte limit exceeded.');
      abort(options.signal);
      return result;
    };
    try {
      if (total > options.maxArchiveBytes)
        throw new RangeError('Export archive byte limit exceeded.');
      yield MAGIC.slice();
      let pieces: Uint8Array[] = [],
        bytes = 0;
      for await (const record of logicalRecords(lease.reader, options)) {
        abort(options.signal);
        const value = encode(record, { maxRecordBytes: options.maxFrameBytes - 4 });
        if (bytes && bytes + value.length + 4 > options.blockBytes) {
          yield await frame(join(pieces, bytes));
          pieces = [];
          bytes = 0;
        }
        const length = new Uint8Array(4);
        new DataView(length.buffer).setUint32(0, value.length, true);
        pieces.push(length, value);
        bytes += value.length + 4;
        if (bytes >= options.blockBytes) {
          yield await frame(join(pieces, bytes));
          pieces = [];
          bytes = 0;
        }
      }
      if (bytes) yield await frame(join(pieces, bytes));
      yield await frame();
    } finally {
      await lease.close();
    }
  })();
}
export async function exportBytes(
  open: () => Promise<SnapshotLease>,
  input: ExportOptions = {},
): Promise<Uint8Array> {
  const options = { ...input, maxArchiveBytes: input.maxArchiveBytes ?? 64 * 1024 * 1024 };
  const pieces: Uint8Array[] = [];
  for await (const piece of exportStream(open, options)) pieces.push(piece);
  return join(pieces);
}
async function* chunks(input: Exclude<ArchiveInput, Uint8Array>): AsyncGenerator<Uint8Array> {
  if ('getReader' in input) {
    const reader = input.getReader();
    let ended = false;
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) {
          ended = true;
          return;
        }
        yield result.value;
      }
    } finally {
      try {
        if (!ended) await reader.cancel();
      } finally {
        reader.releaseLock();
      }
    }
  } else yield* input;
}
class ByteReader {
  private current: Uint8Array = new Uint8Array();
  private offset = 0;
  private received = 0;
  constructor(
    private iterator: AsyncIterator<Uint8Array>,
    private maxBytes: number,
    private signal?: AbortSignal,
  ) {}
  async read(length: number, optional = false): Promise<Uint8Array | undefined> {
    const result = new Uint8Array(length);
    let at = 0;
    while (at < length) {
      abort(this.signal);
      if (this.offset === this.current.length) {
        const next = await this.iterator.next();
        abort(this.signal);
        if (next.done) {
          if (optional && !at) return undefined;
          return corrupt('truncated data');
        }
        if (!(next.value instanceof Uint8Array))
          throw new TypeError('Archive chunks must be Uint8Array.');
        this.received += next.value.length;
        if (this.received > this.maxBytes)
          throw new RangeError('Import archive byte limit exceeded.');
        this.current = new Uint8Array(next.value);
        this.offset = 0;
        if (!this.current.length) continue;
      }
      const amount = Math.min(length - at, this.current.length - this.offset);
      result.set(this.current.subarray(this.offset, this.offset + amount), at);
      this.offset += amount;
      at += amount;
    }
    return result;
  }
  async close() {
    await this.iterator.return?.();
  }
}
/** Validate each bounded compressed frame and the chained terminal frame before allowing a commit. */
async function* decodeRecords(
  input: Exclude<ArchiveInput, Uint8Array>,
  options: Required<Pick<ImportOptions, 'maxFrameBytes' | 'maxArchiveBytes' | 'maxDecodedBytes'>> &
    ImportOptions,
): AsyncGenerator<RecordValue> {
  const reader = new ByteReader(chunks(input), options.maxArchiveBytes, options.signal);
  try {
    const magic = await reader.read(MAGIC.length);
    if (!magic?.every((byte, i) => byte === MAGIC[i])) corrupt('unsupported format');
    const codec = await decoder();
    let previous: Uint8Array = new Uint8Array(32),
      sequence = 0,
      decoded = 0;
    for (;;) {
      const header = (await reader.read(HEADER))!,
        view = new DataView(header.buffer);
      const seq = view.getUint32(0, true),
        rawBytes = view.getUint32(4, true),
        packedBytes = view.getUint32(8, true);
      if (seq !== sequence++) corrupt('frame sequence mismatch');
      if (rawBytes > options.maxFrameBytes || packedBytes > options.maxFrameBytes)
        throw new RangeError('Import frame byte limit exceeded.');
      if (Boolean(rawBytes) !== Boolean(packedBytes)) corrupt('invalid frame lengths');
      decoded += rawBytes;
      if (decoded > options.maxDecodedBytes)
        throw new RangeError('Import decoded-byte limit exceeded.');
      const packed = (await reader.read(packedBytes))!;
      const actual = await digest(previous, header.subarray(0, 12), packed);
      if (!actual.every((byte, i) => byte === header[i + 12])) corrupt('frame digest mismatch');
      previous = actual;
      if (!rawBytes) {
        if (await reader.read(1, true)) corrupt('trailing bytes');
        return;
      }
      abort(options.signal);
      const raw = codec.decompress(packed, { maxOutputSize: rawBytes });
      if (raw.length !== rawBytes) corrupt('decoded length mismatch');
      let at = 0;
      while (at < raw.length) {
        if (at + 4 > raw.length) corrupt('truncated record length');
        const length = new DataView(raw.buffer, raw.byteOffset + at, 4).getUint32(0, true);
        at += 4;
        if (!length || at + length > raw.length) corrupt('invalid record length');
        yield decode(raw.subarray(at, at + length), {
          maxRecordBytes: options.maxFrameBytes,
        }) as RecordValue;
        at += length;
      }
    }
  } finally {
    await reader.close();
  }
}
/**
 * import() owns its input: after the import settles, a stream or iterator it never read, or read only partly, is
 * closed. The decoder already closes what it started reading; this covers failures before the first read (a
 * non-empty target, an aborted signal, a transaction that rejects before running), which would otherwise keep a
 * caller's file handle open. Closing an exhausted input is a no-op, and a close failure never hides the import's
 * own outcome. VERIFIED: tests/archive.test.ts checks a ReadableStream and a real fs.ReadStream.
 */
export async function releaseImport(input: ArchiveInput): Promise<void> {
  try {
    if ('getReader' in input) {
      if (!input.locked) await input.cancel();
    } else if (typeof (input as { destroy?: unknown }).destroy === 'function') {
      // A Node.js Readable: its async iterator is a generator that only cleans up once started.
      (input as unknown as { destroy(): void }).destroy();
    } else if (Symbol.asyncIterator in input) await input[Symbol.asyncIterator]().return?.();
    else if (!(input instanceof Uint8Array)) input[Symbol.iterator]().return?.();
  } catch {
    // The import result or error is what the caller needs; a producer that fails to close adds nothing.
  }
}
/** Captures byte-array input synchronously; iterable inputs are copied one chunk at a time as pulled. */
export function captureImport(input: ArchiveInput, settings: ImportOptions = {}) {
  const options = {
    ...settings,
    mode: settings.mode ?? 'empty',
    conflicts: settings.conflicts ?? 'error',
    maxFrameBytes: integer(
      settings.maxFrameBytes ?? MAX_FRAME,
      'maxFrameBytes',
      1024,
      256 * 1024 * 1024,
    ),
    maxArchiveBytes: integer(settings.maxArchiveBytes ?? 1024 ** 3, 'maxArchiveBytes'),
    maxDecodedBytes: integer(settings.maxDecodedBytes ?? 1024 ** 3, 'maxDecodedBytes'),
    maxDocuments: integer(settings.maxDocuments ?? 1_000_000, 'maxDocuments', 0),
    maxHistoryRecords: integer(settings.maxHistoryRecords ?? 1000000, 'maxHistoryRecords', 0),
    maxCollections: integer(settings.maxCollections ?? 10_000, 'maxCollections', 0),
  };
  if (
    !['empty', 'merge'].includes(options.mode) ||
    !['error', 'replace', 'skip'].includes(options.conflicts)
  )
    throw new TypeError('Invalid import mode or conflicts policy.');
  if (input instanceof Uint8Array) {
    if (input.length > options.maxArchiveBytes)
      throw new RangeError('Import archive byte limit exceeded.');
    input = [new Uint8Array(input)];
  }
  return { input, options };
}
/** A whole archive is one optimistic transaction: corruption, limit errors or conflicts publish nothing. */
export async function importRecords(tx: Writer, prepared: ReturnType<typeof captureImport>) {
  const { input, options } = prepared;
  abort(options.signal);
  if (options.mode === 'empty')
    for await (const row of tx.scan())
      if (row.key !== FORMAT_KEY)
        throw new DatabaseError(
          'SCHEMA_MISMATCH',
          'Import requires an empty database; select mode: merge explicitly.',
        );
  const schemas = new Map<string, { schema: Schema; fresh: boolean }>();
  let manifestVersion: 2 | 3 = 2;
  let historyRecords = 0,
    lastHistoryCollection = '',
    lastHistoryKey = '',
    lastToken = '',
    lastTime: number | undefined;
  let sources: Origins = {};
  let importedClock: { ms: number; seq: number } | undefined;
  let sourceRevision = -1,
    documents = 0,
    imported = 0,
    skipped = 0,
    lastCollection = '',
    lastKey = '',
    lastDocumentCollection = '',
    ended = false,
    sawDocument = false;
  for await (const record of decodeRecords(input, options)) {
    abort(options.signal);
    if (!record || typeof record !== 'object' || ended) corrupt('invalid record order');
    if (sourceRevision < 0) {
      if (
        record.type !== 'manifest' ||
        record.format !== 'defuss-db' ||
        // Only the manifests this build writes: 2 (latest) and 3 (full history). Older layouts are not read.
        ![2, 3].includes(record.version) ||
        !Number.isSafeInteger(record.revision) ||
        record.revision < 0
      )
        corrupt('invalid manifest');
      manifestVersion = record.version;
      sourceRevision = record.revision;
      if (manifestVersion === 3) {
        if (options.mode !== 'empty')
          throw new DatabaseError(
            'SCHEMA_MISMATCH',
            'Full history restoration requires an empty target.',
          );
        if (
          !record.storeId ||
          !validId(record.storeId) ||
          !record.sources ||
          typeof record.sources !== 'object'
        )
          corrupt('invalid history manifest');
        sources = { ...record.sources, [record.storeId!]: record.revision };
        for (const [id, tip] of Object.entries(sources)) {
          if (!validId(id) || !Number.isSafeInteger(tip) || tip < 0) corrupt('invalid lineage');
          if (id === storeIdentity((await tx.get(FORMAT_KEY)).value))
            corrupt('source identity overlaps target');
          tx.put(lineage(id), tip);
        }
        if (record.clock) {
          importedClock = checkedClock(record.clock);
          tx.put(CLOCK, importedClock);
        }
      }
      continue;
    }
    if (record.type === 'schema') {
      collectionName(record.collection);
      if (sawDocument || record.collection <= lastCollection)
        corrupt('schemas must be unique and sorted before documents');
      if (schemas.size >= options.maxCollections)
        throw new RangeError('Import collection limit exceeded.');
      if (!record.schema || record.schema.version !== 1) corrupt('invalid schema record');
      const schema = readSchema(record.schema);
      if (schema.activating) corrupt('incomplete baseline schema');
      if (schema.history && (manifestVersion !== 3 || !importedClock))
        corrupt('tracked schema requires history manifest and clock');
      const existing = await tx.get(schemaKey(record.collection));
      const target = readSchema(existing.value);
      if (target.activating)
        throw new DatabaseError(
          'HISTORY_ACTIVATING',
          'Finish the target baseline before merging an archive.',
        );
      const targetSchema = manifestVersion === 3 ? target : currentSchema(target);
      // A collection written without DDL exists through its r: marker and has the implicit default schema.
      const exists = existing.found || (await tx.get(versionKey(record.collection))).found;
      if (exists && JSON.stringify(targetSchema) !== JSON.stringify(schema))
        throw new DatabaseError(
          'SCHEMA_MISMATCH',
          `Collection ${record.collection} has another schema.`,
        );
      if (!exists)
        await saveSchema(tx, record.collection, {
          version: 1,
          indexes: [],
          searchIndexes: [],
          ...(schema.timestamps ? { timestamps: true as const } : {}),
        });
      schemas.set(record.collection, { schema, fresh: !exists });
      if (record.entry !== undefined)
        await importEntry(tx, record.collection, record.entry, options.conflicts);
      lastCollection = record.collection;
    } else if (record.type === 'document') {
      if (historyRecords) corrupt('document after history records');
      sawDocument = true;
      collectionName(record.collection);
      assertDocument(record.document);
      const key = documentKey(record.collection, record.document.id);
      if (
        !schemas.has(record.collection) ||
        record.collection < lastDocumentCollection ||
        (record.collection === lastDocumentCollection && key <= lastKey)
      )
        corrupt('documents must be unique, sorted and declared');
      lastKey = key;
      lastDocumentCollection = record.collection;
      if (++documents > options.maxDocuments)
        throw new RangeError('Import document limit exceeded.');
      if (options.conflicts === 'skip' && (await tx.get(key)).found) {
        skipped++;
        continue;
      }
      // Archived timestamps are kept, so a restore does not move them to the import time.
      // VERIFIED: tests/timestamps.test.ts imports an archive and reads the documents back unchanged.
      await putDocument(
        tx,
        record.collection,
        record.document,
        options.conflicts !== 'replace',
        undefined,
        undefined,
        'keep',
        // Documents the source held before its schema was set are restored as they are. VERIFIED:
        // tests/schema-validation.test.ts imports an archive whose document violates the schema it carries.
        false,
      );
      imported++;
    } else if (record.type === 'history') {
      sawDocument = true;
      if (
        manifestVersion !== 3 ||
        !schemas.get(record.collection)?.schema.history ||
        !importedClock ||
        ++historyRecords > options.maxHistoryRecords
      )
        corrupt('invalid or excessive history records');
      const value = record.value,
        key = record.key,
        c = record.collection;
      if (
        !value?.origin ||
        !validId(value.origin) ||
        !value.origins ||
        !Object.hasOwn(value.origins, value.origin)
      )
        corrupt('missing original revision');
      for (const [id, rev] of Object.entries(value.origins!))
        if (
          !Object.hasOwn(sources, id) ||
          !Number.isSafeInteger(rev) ||
          rev < 1 ||
          rev > sources[id]!
        )
          corrupt('invalid original revision');
      if (c < lastHistoryCollection || (c === lastHistoryCollection && key <= lastHistoryKey))
        corrupt('unsorted or repeated history record');
      if (c !== lastHistoryCollection) {
        lastToken = '';
        lastTime = undefined;
      }
      if (key.startsWith('a:')) {
        const { token, fact } = parseFact(c, key, value);
        projectAudit(tx, c, token, key, fact);
        if (token !== lastToken || fact.time !== lastTime) {
          projectBoundary(tx, c, token, key, fact);
          if (token !== lastToken) tx.put(heads(c) + token, fact.time);
        }
        lastToken = token;
        lastTime = fact.time;
      } else parseEvent(c, key, value);
      if (value.seq > importedClock!.seq) corrupt('history sequence exceeds source clock');
      tx.put(key, value);
      lastHistoryCollection = c;
      lastHistoryKey = key;
    } else if (record.type === 'end') {
      if (manifestVersion === 3 && record.historyRecords !== historyRecords)
        corrupt('history count mismatch');
      if (record.documents !== documents || record.collections !== schemas.size)
        corrupt('record counts mismatch');
      ended = true;
    } else corrupt('unexpected record');
  }
  if (!ended || sourceRevision < 0) corrupt('missing end record');
  // Backfill after loading: each derived index is built once, and its uniqueness/limits still govern the same commit.
  for (const [collection, { schema, fresh }] of schemas)
    if (fresh) {
      for (const index of schema.indexes)
        await createIndex(
          tx,
          collection,
          index.temporalUnique ? { ...index, temporalUnique: undefined } : index,
        );
      for (const index of schema.searchIndexes) await createSearchIndex(tx, collection, index);
      if (schema.history) {
        await fence(tx);
        tx.put(activationKey(collection), schema.history.coverageFrom);
        touchHistory(tx, collection);
        await saveSchema(tx, collection, schema, false);
        await verifyTimeline(tx, collection, schema);
      }
    }
  return { imported, skipped, collections: schemas.size, sourceRevision };
}

function validId(id: string) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
}
