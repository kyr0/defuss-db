import { clearPostings, projectionStats } from './history-index-cache.js';
import { collectionVersion } from './collection-version.js';
import type { Page } from 'defuss-dataview/compute';
import { encode, decode } from 'defuss-dson/binary';
import type { QueryOptions, ReadContext, Reader, Document } from './types.js';

export interface QueryCacheOptions {
  /** Automatic result admission is the default; manual caches only queries that opt in. */
  mode?: 'auto' | 'manual';
  minScannedRows?: number;
  maxOutputRatio?: number;
  maxPlans?: number;
  maxPlanBytes?: number;
  maxPendingQueries?: number;
  maxEntries?: number;
  /** Separate retained budget for sorted historical index postings. Set zero to disable. */
  maxTemporalIndexBytes?: number;
  /** Includes encoded results, keys and estimated entry overhead; history has its own reported budget within it. */
  maxBytes?: number;
  maxEntryBytes?: number;
  maxKeyBytes?: number;
  policy?: 'lru' | 'slru';
  admission?: 'always' | 'second-hit';
}
export interface QueryCacheStats {
  temporalIndexes: number;
  temporalIndexBytes: number;
  mode: 'auto' | 'manual';
  autoBypasses: number;
  crossRevisionHits: number;
  versionReads: number;
  invalidations: number;
  coalesced: number;
  planHits: number;
  planMisses: number;
  plans: number;
  planBytes: number;
  pendingQueries: number;
  pendingBytes: number;
  hits: number;
  misses: number;
  admissions: number;
  rejections: number;
  evictions: number;
  entries: number;
  bytes: number;
  historyEntries: number;
  historyBytes: number;
  policy: 'lru' | 'slru';
  admission: 'always' | 'second-hit';
}
interface Entry {
  scope?: string;
  value: Uint8Array;
  bytes: number;
}
interface Pending {
  epoch: number;
  followers: number;
  promise: Promise<{ bytes?: Uint8Array; error?: unknown }>;
  resolve(value: { bytes?: Uint8Array; error?: unknown }): void;
  cost: number;
}
const defaults = {
  maxTemporalIndexBytes: 8 * 1024 * 1024,
  mode: 'auto' as const,
  minScannedRows: 128,
  maxOutputRatio: 0.25,
  maxPlans: 64,
  maxPlanBytes: 1024 * 1024,
  maxPendingQueries: 16,
  maxEntries: 128,
  maxBytes: 16 * 1024 * 1024,
  maxEntryBytes: 2 * 1024 * 1024,
  maxKeyBytes: 16 * 1024,
  policy: 'slru' as const,
  admission: 'second-hit' as const,
};
/** Exact keys, bounded second-use history, and probation/protected LRU segments. No probabilistic result lookup. */
export class QueryCache {
  readonly options: Required<QueryCacheOptions>;
  private probation = new Map<string, Entry>();
  private protected = new Map<string, Entry>();
  private history = new Map<string, number>();
  private liveVersions = new Map<string, string>();
  private plans = new Map<string, { value: unknown; bytes: number }>();
  private planBytes = 0;
  private pending = new Map<string, Pending>();
  private pendingBytes = 0;
  private knownVersions = new Map<string, { head: number; version: number }>();
  private extra = {
    crossRevisionHits: 0,
    versionReads: 0,
    invalidations: 0,
    autoBypasses: 0,
    coalesced: 0,
    planHits: 0,
    planMisses: 0,
  };
  private used = 0;
  private protectedBytes = 0;
  private historyBytes = 0;
  private counters = { hits: 0, misses: 0, admissions: 0, rejections: 0, evictions: 0 };
  epoch = 0;
  constructor(options: QueryCacheOptions = {}) {
    this.options = { ...defaults, ...options };
    if (
      !Number.isSafeInteger(this.options.maxTemporalIndexBytes) ||
      this.options.maxTemporalIndexBytes < 0
    )
      throw new RangeError('maxTemporalIndexBytes must be a nonnegative safe integer.');
    for (const key of [
      'maxEntries',
      'maxBytes',
      'maxEntryBytes',
      'maxKeyBytes',
      'maxPlans',
      'maxPlanBytes',
      'maxPendingQueries',
      'minScannedRows',
    ] as const) {
      const value = this.options[key];
      if (!Number.isSafeInteger(value) || value < 1)
        throw new RangeError(`queryCache.${key} must be a positive safe integer.`);
    }
    if (
      !['auto', 'manual'].includes(this.options.mode) ||
      !Number.isFinite(this.options.maxOutputRatio) ||
      this.options.maxOutputRatio <= 0 ||
      this.options.maxOutputRatio > 1 ||
      !['lru', 'slru'].includes(this.options.policy) ||
      !['always', 'second-hit'].includes(this.options.admission)
    )
      throw new TypeError('Invalid query-cache policy or admission.');
  }
  stats(): QueryCacheStats {
    return {
      ...projectionStats(this),
      ...this.counters,
      ...this.extra,
      mode: this.options.mode,
      plans: this.plans.size,
      planBytes: this.planBytes,
      pendingQueries: this.pending.size,
      pendingBytes: this.pendingBytes,
      entries: this.probation.size + this.protected.size,
      bytes: this.used + this.historyBytes,
      historyEntries: this.history.size,
      historyBytes: this.historyBytes,
      policy: this.options.policy,
      admission: this.options.admission,
    };
  }
  clear(): void {
    clearPostings(this);
    this.epoch++;
    this.probation.clear();
    this.protected.clear();
    this.history.clear();
    this.liveVersions.clear();
    this.knownVersions.clear();
    this.plans.clear();
    this.planBytes = 0;
    this.used = this.protectedBytes = this.historyBytes = 0;
  }
  /** Same persisted head implies the same collection stamp. Check the pinned record whenever the head changes. */
  async version(reader: Reader, collection: string, epoch: number): Promise<number> {
    const known = this.knownVersions.get(collection);
    if (known?.head === reader.revision) return known.version;
    this.extra.versionReads++;
    const version = await collectionVersion(reader, collection);
    if (
      this.epoch === epoch &&
      reader.revision >= (this.knownVersions.get(collection)?.head ?? 0)
    ) {
      this.knownVersions.delete(collection);
      this.knownVersions.set(collection, { head: reader.revision, version });
      if (this.knownVersions.size > Math.min(128, this.options.maxEntries))
        this.knownVersions.delete(this.knownVersions.keys().next().value!);
    }
    return version;
  }
  decodeAt<R>(bytes: Uint8Array, revision: number): R {
    const result = decode(bytes, { maxRecordBytes: this.options.maxEntryBytes }) as R & {
      summary: { revision: number };
    };
    if (result.summary.revision !== revision) {
      this.extra.crossRevisionHits++;
      // The collection and its access paths are identical. Report the caller's actual pinned snapshot.
      result.summary.revision = revision;
    }
    return result;
  }
  lookup(
    key: string,
    refresh = false,
    scope?: string,
  ): { value?: Uint8Array; admit: boolean; epoch: number } {
    if (scope) {
      const prior = this.liveVersions.get(scope);
      if (prior && prior !== key) {
        this.remove(prior);
        this.extra.invalidations++;
      }
    }
    const hot = this.protected.get(key),
      cold = this.probation.get(key),
      item = hot ?? cold;
    if (item && !refresh) {
      this.counters.hits++;
      if (hot) {
        this.protected.delete(key);
        this.protected.set(key, hot);
      } else {
        this.probation.delete(key);
        if (this.options.policy === 'slru') {
          this.protected.set(key, item);
          this.protectedBytes += item.bytes;
          this.demote();
        } else this.probation.set(key, item);
      }
      return { value: item.value, admit: false, epoch: this.epoch };
    }
    this.counters.misses++;
    const seen = this.history.get(key);
    const admit = refresh || this.options.admission === 'always' || seen !== undefined;
    if (seen !== undefined) {
      this.history.delete(key);
      this.historyBytes -= seen;
    }
    if (!admit) {
      const size = key.length * 2 + 64;
      if (size <= this.options.maxBytes / 8) {
        this.history.set(key, size);
        this.historyBytes += size;
      }
      while (
        this.history.size > this.options.maxEntries * 2 ||
        this.historyBytes > this.options.maxBytes / 8 ||
        this.used + this.historyBytes > this.options.maxBytes
      )
        this.dropHistory();
    }
    return { admit, epoch: this.epoch };
  }
  put(key: string, value: unknown, epoch: number, scope?: string): Uint8Array | undefined {
    if (epoch !== this.epoch) return;
    let bytes: Uint8Array;
    try {
      bytes = encode(value, {
        maxRecordBytes: Math.min(this.options.maxEntryBytes, this.options.maxBytes),
      });
    } catch {
      this.counters.rejections++;
      return;
    }
    const cost = (key.length + (scope?.length ?? 0)) * 2 + bytes.length + 128;
    if (cost > this.options.maxEntryBytes || cost > this.options.maxBytes) {
      this.counters.rejections++;
      return;
    }
    this.remove(key);
    const historyBytes = this.history.get(key);
    if (historyBytes !== undefined) {
      this.history.delete(key);
      this.historyBytes -= historyBytes;
    }
    this.probation.set(key, { value: bytes, bytes: cost, scope });
    if (scope) this.liveVersions.set(scope, key);
    this.used += cost;
    this.counters.admissions++;
    while (this.used + this.historyBytes > this.options.maxBytes && this.history.size)
      this.dropHistory();
    while (
      this.probation.size + this.protected.size > this.options.maxEntries ||
      this.used + this.historyBytes > this.options.maxBytes
    ) {
      const victim = this.probation.keys().next().value ?? this.protected.keys().next().value!;
      this.remove(victim);
      this.counters.evictions++;
    }
    return bytes;
  }
  /** Plan keys are exact; only live contexts use this bounded cache, never snapshot/transaction closures. */
  plan<P>(key: string, build: () => P): P {
    const hit = this.plans.get(key);
    if (hit) {
      this.extra.planHits++;
      this.plans.delete(key);
      this.plans.set(key, hit);
      return hit.value as P;
    }
    this.extra.planMisses++;
    const value = build(),
      bytes = key.length * 2 + 2048;
    if (bytes <= this.options.maxPlanBytes) {
      this.plans.set(key, { value, bytes });
      this.planBytes += bytes;
      while (
        this.plans.size > this.options.maxPlans ||
        this.planBytes > this.options.maxPlanBytes
      ) {
        const first = this.plans.keys().next().value!;
        this.planBytes -= this.plans.get(first)!.bytes;
        this.plans.delete(first);
      }
    }
    return value;
  }
  eligible(result: unknown): boolean {
    const summary = (
      result as { summary?: { scannedRows: number; returnedRows: number; peakOutputBytes: number } }
    )?.summary;
    return (
      !!summary &&
      summary.scannedRows >= this.options.minScannedRows &&
      summary.returnedRows <= summary.scannedRows * this.options.maxOutputRatio &&
      summary.peakOutputBytes <= this.options.maxEntryBytes
    );
  }
  bypass(key: string): void {
    this.extra.autoBypasses++;
    const bytes = this.history.get(key);
    if (bytes !== undefined) {
      this.history.delete(key);
      this.historyBytes -= bytes;
    }
  }
  join(key: string): { pending: Pending; leader: boolean } | undefined {
    const previous = this.pending.get(key);
    if (previous?.epoch === this.epoch) {
      previous.followers++;
      return { pending: previous, leader: false };
    }
    // Key storage is separately bounded; computation working memory remains a per-query budget.
    if (previous || this.pending.size >= this.options.maxPendingQueries) return;
    let resolve!: Pending['resolve'];
    const promise = new Promise<{ bytes?: Uint8Array; error?: unknown }>((done) => {
      resolve = done;
    });
    const pending = {
      promise,
      resolve,
      epoch: this.epoch,
      followers: 0,
      cost: key.length * 2 + 256,
    };
    this.pending.set(key, pending);
    this.pendingBytes += pending.cost;
    return { pending, leader: true };
  }
  finish(key: string, pending: Pending, result: { bytes?: Uint8Array; error?: unknown }): void {
    if (this.pending.get(key) === pending) {
      this.pending.delete(key);
      this.pendingBytes -= pending.cost;
    }
    pending.resolve(result);
  }
  shared(): void {
    this.extra.coalesced++;
  }
  private dropHistory(): void {
    const key = this.history.keys().next().value;
    if (key === undefined) return;
    this.historyBytes -= this.history.get(key)!;
    this.history.delete(key);
  }
  private remove(key: string): void {
    const cold = this.probation.get(key),
      hot = this.protected.get(key);
    const scope = (cold ?? hot)?.scope;
    if (scope && this.liveVersions.get(scope) === key) this.liveVersions.delete(scope);
    if (cold) {
      this.used -= cold.bytes;
      this.probation.delete(key);
    }
    if (hot) {
      this.used -= hot.bytes;
      this.protectedBytes -= hot.bytes;
      this.protected.delete(key);
    }
  }
  private demote(): void {
    while (
      this.protected.size > Math.floor(this.options.maxEntries * 0.8) ||
      this.protectedBytes > this.options.maxBytes * 0.8
    ) {
      const key = this.protected.keys().next().value!,
        entry = this.protected.get(key)!;
      this.protected.delete(key);
      this.protectedBytes -= entry.bytes;
      this.probation.set(key, entry);
    }
  }
}
/** Tagged exact text avoids DSON+hex work for scalar ASTs. Unsupported/identity graphs bypass caching.
 * Property order is preserved because projection/group aliases expose that order to callers.
 */
export function cacheDescriptor(
  value: unknown,
  maxBytes = defaults.maxKeyBytes,
): string | undefined {
  const active = new Set<object>(),
    parts: string[] = [];
  let bytes = 0,
    nodes = 0;
  const append = (text: string) => {
    bytes += text.length * 2;
    if (bytes > maxBytes) throw 0;
    parts.push(text);
  };
  const scalar = (value: unknown) =>
    value == null ||
    ['undefined', 'string', 'number', 'boolean', 'bigint'].includes(typeof value) ||
    value instanceof Date ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value);
  function visit(value: unknown, depth: number) {
    if (++nodes > 4096 || depth > 64) throw 0;
    if (value === null) {
      append('z');
      return;
    }
    switch (typeof value) {
      case 'undefined':
        append('u');
        return;
      case 'string':
        append('s' + JSON.stringify(value));
        return;
      case 'boolean':
        append(value ? 't' : 'f');
        return;
      case 'number':
        append('n' + (Object.is(value, -0) ? '-0' : String(value)));
        return;
      case 'bigint':
        append('b' + String(value));
        return;
      case 'object':
        break;
      default:
        throw 0;
    }
    const object = value as object;
    if (active.has(object)) throw 0;
    if (value instanceof Date || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const encoded = encode(value, {
        maxRecordBytes: Math.max(1, Math.floor((maxBytes - bytes) / 4)),
      });
      append('x');
      for (const byte of encoded) append(byte.toString(16).padStart(2, '0'));
      return;
    }
    if (
      Array.isArray(value)
        ? Object.getPrototypeOf(value) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      throw 0;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(value as object).some((key) => typeof key !== 'string') ||
      Object.entries(descriptors).some(
        ([key, d]) =>
          !Object.hasOwn(d, 'value') ||
          (!d.enumerable && !(Array.isArray(value) && key === 'length')),
      )
    )
      throw 0;
    if (descriptors.equality?.value === 'identity') throw 0;
    if (Object.hasOwn(descriptors, 'value') && typeof descriptors.op?.value === 'string') {
      const operand = descriptors.value!.value;
      // Native object literals expose compiled constants and AST alias identity. Never share those plans/results.
      if (descriptors.op?.value === 'literal' && operand !== null && typeof operand === 'object')
        throw 0;
      if (
        !scalar(operand) &&
        !(descriptors.op?.value === 'in' && Array.isArray(operand) && operand.every(scalar))
      )
        throw 0;
    }
    active.add(object);
    if (Array.isArray(value)) {
      if (Object.keys(descriptors).length !== value.length + 1) throw 0;
      append('[');
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(descriptors, String(i))) throw 0;
        visit(descriptors[String(i)]!.value, depth + 1);
        append(',');
      }
      append(']');
    } else {
      append('{');
      for (const key of Object.keys(descriptors)) {
        append(JSON.stringify(key) + ':');
        visit(descriptors[key]!.value, depth + 1);
        append(',');
      }
      append('}');
    }
    active.delete(object);
  }
  try {
    visit(value, 0);
    return parts.join('');
  } catch {
    return undefined;
  }
}
/** Even a cache hit opens the current snapshot. Transaction contexts never receive this cache. */
export async function cachedEvaluate<T extends Document, R>(
  context: ReadContext,
  collection: string,
  descriptor: string | undefined,
  page: Page | undefined,
  input: QueryOptions<T> | undefined,
  evaluate: (
    context: ReadContext,
    page: Page | undefined,
    options: QueryOptions<T> | undefined,
  ) => Promise<R>,
): Promise<R> {
  // The key and execution must observe identical options/pages even if the caller mutates them while opening a snapshot.
  const captured = input && { ...input },
    capturedPage = page && { ...page };
  const run = (context: ReadContext) => evaluate(context, capturedPage, captured);
  const cache = context.queryCache;
  const { cache: requested, signal, ...settings } = captured ?? {};
  const use = requested ?? (cache?.options.mode === 'auto' ? 'auto' : false);
  if (use !== undefined && use !== false && use !== true && use !== 'auto' && use !== 'refresh')
    throw new TypeError('cache must be boolean, auto or refresh.');
  if (
    !use ||
    !cache ||
    descriptor === undefined ||
    captured?.sizeOf ||
    captured?.sizeOfOutput ||
    (use === 'auto' && captured?.profile)
  )
    return run(context);
  const suffix =
    capturedPage === undefined && !Reflect.ownKeys(settings).length
      ? '_'
      : cacheDescriptor({ page: capturedPage, settings }, cache.options.maxKeyBytes);
  if (suffix === undefined) return run(context);
  const abort = () => {
    if (signal?.aborted) throw signal.reason ?? new Error('Aborted');
  };
  abort();
  context.check();
  const startEpoch = cache.epoch;
  const lease = await context.open();
  try {
    abort();
    context.check();
    const version = context.cacheNamespace
      ? await lease.reader.temporalVersion!()
      : await cache.version(lease.reader, collection, startEpoch);
    const namespace = context.cacheNamespace ?? collection;
    abort();
    context.check();
    const key = `${namespace}:${version}:${descriptor}:${suffix}`;
    if (startEpoch !== cache.epoch || key.length * 2 > cache.options.maxKeyBytes)
      return await run({
        ...context,
        open: async () => ({ reader: lease.reader, close: async () => {} }),
      });
    const scope = context.cachePlans ? `${collection}:${descriptor}:${suffix}` : undefined;
    const hit = cache.lookup(key, use === 'refresh', scope);
    if (hit.value) return cache.decodeAt<R>(hit.value, lease.reader.revision);
    // Signal-bearing callers execute independently: one cancellation must never cancel or delay another caller.
    const joined = context.cachePlans && !signal && use !== 'refresh' ? cache.join(key) : undefined;
    if (joined && !joined.leader) {
      const shared = await joined.pending.promise;
      abort();
      context.check();
      if ('error' in shared) throw shared.error;
      if (shared.bytes) {
        cache.shared();
        return cache.decodeAt<R>(shared.bytes, lease.reader.revision);
      }
    }
    try {
      const result = await run({
        ...context,
        open: async () => ({ reader: lease.reader, close: async () => {} }),
      });
      abort();
      context.check();
      let bytes: Uint8Array | undefined;
      if (use === 'auto' && !cache.eligible(result)) cache.bypass(key);
      else if (hit.admit || (joined?.leader && joined.pending.followers > 0))
        bytes = cache.put(key, result, hit.epoch, scope);
      if (joined?.leader) cache.finish(key, joined.pending, { bytes });
      return result;
    } catch (error) {
      if (joined?.leader) cache.finish(key, joined.pending, { error });
      throw error;
    }
  } finally {
    await lease.close();
  }
}
