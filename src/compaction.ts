import type { Dbsonl } from 'defuss-dbsonl';

export interface AutoCompactOptions {
  /** No automatic compaction below this many committed bytes. Default 1 MiB. */
  minBytes?: number;
  /** Under sustained writes, compact once committed bytes reach this multiple of the live size. Default 4. */
  growth?: number;
  /** Compact without blocking writers once this connection has not committed for this long. Default 1000 ms. */
  idleMs?: number;
}
export interface AutoCompactStats {
  state: 'off' | 'idle' | 'running' | 'waiting';
  runs: number;
  conflicts: number;
  failures: number;
  reclaimedBytes: number;
}
type Settings = Required<AutoCompactOptions>;
type Trigger = 'bound' | 'idle';
interface Attempt {
  trigger: Trigger;
  abort: AbortController;
  /** Set once the copy starts; a commit during the size check does not interrupt anything. */
  copying: boolean;
}

// VERIFIED: with a floor of 8 MiB a 10,000-document store with one ordered index (3 MiB on DBSONL 0.9) was never
// copied, so its values stayed in commit order and an index range count took 1.42 ms instead of 0.20 ms after
// compact(); a copy costs about 10 ms per MiB (0.25 to 0.34 s for 28 MiB).
const DEFAULTS: Settings = { minBytes: 1024 * 1024, growth: 4, idleMs: 1000 };
// An idle copy runs once garbage reaches half the live size.
const IDLE_GROWTH = 1.5;
// An idle copy also runs once the file has grown by half since it was packed, even with little garbage: then a third
// of it or more lies in commit order instead of key order, and range reads there go to scattered frames. VERIFIED: a
// 100,000-document load with one ordered index on DBSONL 0.9 left 1.12 times its packed size, so the garbage trigger
// never ran; an index range count then took 19 ms instead of 0.64 ms after compact(), and a full-scan aggregate 120 ms
// instead of 80 ms (85 instead of 21 ms with query workers). Waiting for the file to double was measured too coarse: under
// Node.js a 10,000-document load ended at 2.9 MiB without doubling the size of its one copy during the load, and its
// range count took 1.32 ms against 0.38 ms under Bun, whose run did copy again. Copying at each 1.5-fold growth copies at most three times
// the final size in all.
const IDLE_REORDER = 1.5;
// Below this many bytes a store's fixed bytes overstate its bytes per entry, so such a size is used unscaled.
// VERIFIED: a packed in-memory store with 3 entries took 690 bytes, 230 per entry; from 23 entries on it took
// 112 to 125 bytes per entry, so at 64 KiB the fixed bytes are about 1%.
const REFERENCE_BYTES = 64 * 1024;
// A conflict caused by another process retries after this delay.
const RETRY_MS = 250;

export function autoCompactSettings(options: false | AutoCompactOptions | undefined) {
  if (options === false) return undefined;
  const settings = { ...DEFAULTS, ...options };
  if (!Number.isSafeInteger(settings.minBytes) || settings.minBytes < 0)
    throw new RangeError('autoCompact.minBytes must be a non-negative integer.');
  if (!Number.isFinite(settings.growth) || settings.growth <= 1)
    throw new RangeError('autoCompact.growth must be a number greater than 1.');
  if (!Number.isSafeInteger(settings.idleMs) || settings.idleMs < 0)
    throw new RangeError('autoCompact.idleMs must be a non-negative integer.');
  return settings;
}

/** Pure policy: a copy pays off once garbage has grown the file by `growth` over its live size. */
export function compactionDue(
  committedBytes: number,
  liveBytes: number,
  settings: { minBytes: number; growth: number },
): boolean {
  return committedBytes >= Math.max(settings.minBytes, settings.growth * liveBytes);
}

/** Pure policy: an idle copy that restores key order pays off once the file grew by half since it was packed. */
export function layoutDue(committedBytes: number, packedBytes: number, minBytes: number): boolean {
  return committedBytes >= Math.max(minBytes, IDLE_REORDER * packedBytes);
}

/** The packed size a connection knows, with the stored entries it held when that size was measured. */
export interface Packed {
  bytes: number;
  /** Undefined below REFERENCE_BYTES: liveBytes() then uses `bytes` unscaled. */
  entries: number | undefined;
}
export function packedAt(bytes: number, entries: number): Packed {
  return { bytes, entries: bytes >= REFERENCE_BYTES ? entries : undefined };
}

/**
 * The live size, estimated as the packed size scaled by the stored entries since. VERIFIED: the packed size
 * alone counts every inserted document as garbage: a 100,000-document load into an empty store grew 3.9
 * times without compaction, yet the bound copied it four times and the load took 9.7 s instead of 4.3 s.
 * Deleting documents shrinks the estimate, because their bytes are garbage now; updates leave it unchanged.
 */
export function liveBytes(packed: Packed, entries: number): number {
  return packed.entries ? packed.bytes * (entries / packed.entries) : packed.bytes;
}

/**
 * VERIFIED: every DBSONL commit appends copy-on-write pages and never reuses space. With DBSONL 0.7 a
 * 100,000-document load with one ordered index left 778 MB for about 70 MB of live data, and scans and index
 * counts on it ran 2 to 12 times slower than after compact(). DBSONL 0.8's compact pages cut that load to 110 MiB
 * for 28 MiB packed, 3.9 times. Fewer than 22,000 updates to a 1,000-document in-memory collection
 * filled the memory backend's 256 MiB file limit.
 *
 * Two triggers share one background copy, both measured against liveBytes(). After `idleMs` without a commit
 * of this connection, an optimistic copy runs once the file is 1.5 times its live size or its packed size; it never blocks writers and is dropped when one
 * commits. Under sustained writes an optimistic copy never installs (VERIFIED: DBSONL returns CONFLICT once a
 * writer published meanwhile), so at `growth` times the live size the copy switches to exclusive mode after
 * one interrupted attempt and writers queue until it is installed. That bounds the file. Compacting at a
 * lower growth during loads was measured slower: growth 2 doubled a 100,000-document load.
 */
export class AutoCompactor {
  private packed: Packed | undefined;
  private running: Promise<void> | undefined;
  private attempt: Attempt | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private exclusive = false;
  private closed = false;
  private readonly counts = { runs: 0, conflicts: 0, failures: 0, reclaimedBytes: 0 };

  constructor(
    private readonly store: Dbsonl<unknown>,
    private readonly settings: Settings,
  ) {}

  /** Never throws and never delays the writer that calls it. */
  committed(): void {
    if (this.closed) return;
    this.armIdle();
    const attempt = this.attempt;
    if (this.running) {
      // This commit published during an optimistic copy, so that copy can no longer install.
      if (attempt?.copying && !this.exclusive) {
        if (attempt.trigger === 'bound') this.exclusive = true;
        attempt.abort.abort();
      }
      return;
    }
    if (!this.retry) this.start('bound');
  }

  /** A manual compaction resets the packed size, so the next commit does not copy the store again. */
  compacted(packedBytes: number, entries: number): void {
    this.packed = packedAt(packedBytes, entries);
    this.exclusive = false;
  }

  stats(): AutoCompactStats {
    return {
      state: this.running ? 'running' : this.retry || this.idle ? 'waiting' : 'idle',
      ...this.counts,
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    clearTimeout(this.retry);
    clearTimeout(this.idle);
    this.retry = this.idle = undefined;
    this.attempt?.abort.abort();
    while (this.running) await this.running;
  }

  private armIdle(): void {
    clearTimeout(this.idle);
    this.idle = this.timer(this.settings.idleMs, () => {
      this.idle = undefined;
      if (!this.running) this.start('idle');
    });
  }

  private timer(ms: number, run: () => void) {
    const handle = setTimeout(run, ms);
    // A pending check must not keep a Node.js or Bun process alive.
    (handle as { unref?: () => void }).unref?.();
    return handle;
  }

  private start(trigger: Trigger): void {
    const attempt: Attempt = { trigger, abort: new AbortController(), copying: false };
    this.attempt = attempt;
    this.running = this.run(attempt).finally(() => {
      this.attempt = undefined;
      this.running = undefined;
      // A bounded copy that a commit interrupted restarts at once, now queuing writers.
      if (attempt.abort.signal.aborted && trigger === 'bound' && this.exclusive && !this.closed)
        this.start('bound');
    });
  }

  private async run(attempt: Attempt) {
    const { trigger, abort } = attempt;
    let committed = 0,
      entries = 0;
    try {
      ({ committedBytes: committed, count: entries } = await this.store.stats());
      // The first check stands in for the packed size of a store this connection did not compact.
      this.packed ??= packedAt(committed, entries);
      const growth =
        trigger === 'bound' ? this.settings.growth : Math.min(IDLE_GROWTH, this.settings.growth);
      if (this.closed) return;
      if (
        !compactionDue(committed, liveBytes(this.packed, entries), { ...this.settings, growth }) &&
        !(trigger === 'idle' && layoutDue(committed, this.packed.bytes, this.settings.minBytes))
      ) {
        // Another connection may have compacted meanwhile; escalate again only after a new interruption.
        this.exclusive = false;
        return;
      }
      attempt.copying = true;
      const result = await this.store.compact({
        mode: trigger === 'bound' && this.exclusive ? 'exclusive' : 'optimistic',
        signal: abort.signal,
      });
      attempt.copying = false;
      await this.store.collect();
      this.counts.runs++;
      this.counts.reclaimedBytes += Math.max(0, result.beforeBytes - result.afterBytes);
      // The count from before the copy: writers queued behind it commit before collect() returns. VERIFIED: a count
      // read afterwards included 512 later entries and set off a second copy of a load that needed one.
      this.packed = packedAt(result.afterBytes, entries);
      this.exclusive = false;
    } catch (error) {
      if (this.closed || abort.signal.aborted) return;
      if ((error as { code?: string }).code === 'CONFLICT') {
        // Another connection published during the copy.
        this.counts.conflicts++;
        if (trigger === 'bound') {
          this.exclusive = true;
          this.retry = this.timer(RETRY_MS, () => {
            this.retry = undefined;
            if (!this.running && !this.closed) this.start('bound');
          });
        }
        // A conflicted idle copy waits for this connection's next commit; retrying on a timer while another
        // process keeps writing would copy the whole store again and again.
      } else {
        // Wait for another growth step instead of repeating a failing copy, for example on a full disk.
        this.counts.failures++;
        this.packed = packedAt(committed, entries);
      }
    }
  }
}
