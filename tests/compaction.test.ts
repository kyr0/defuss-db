import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryBackend, openDatabase, openMemory } from '../src/index.js';
import type { Database } from '../src/index.js';
import { compactionDue, layoutDue, liveBytes, packedAt } from '../src/compaction.js';

const opened: Database[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) await db.close();
});
const track = (db: Database) => (opened.push(db), db);
const minBytes = 256 * 1024,
  idleMs = 10;

async function settled(db: Database) {
  for (;;) {
    const stats = await db.stats();
    if (stats.autoCompaction.state !== 'running' && stats.autoCompaction.state !== 'waiting')
      return stats;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
/** Sustained sequential updates; returns the largest committed size seen while they ran. */
async function churn(db: Database, updates: number) {
  const items = db.collection('items');
  await items.createIndex({ name: 'byRank', fields: ['rank'], order: ['desc'] });
  await items.insertMany(Array.from({ length: 200 }, (_, id) => ({ id, rank: id, note: 'x' })));
  let peak = 0;
  for (let i = 0; i < updates; i++) {
    await items.update(i % 200, { rank: (i * 7919) % 1000 });
    if (i % 50 === 0) peak = Math.max(peak, (await db.stats()).committedBytes);
  }
  return peak;
}

describe('automatic compaction', () => {
  it('keeps a store near its packed size while the same documents are rewritten', async () => {
    const off = track(await openMemory({ autoCompact: false }));
    await churn(off, 1500);
    const grown = await off.stats();
    expect(grown.autoCompaction).toMatchObject({ state: 'off', runs: 0 });

    const on = track(await openMemory({ autoCompact: { minBytes, growth: 2, idleMs } }));
    const peak = await churn(on, 1500);
    // VERIFIED: optimistic copies never install while this connection keeps committing.
    expect(peak).toBeLessThan(grown.committedBytes / 4);
    const stats = await settled(on);
    expect(stats.autoCompaction.runs).toBeGreaterThan(0);
    expect(stats.autoCompaction.failures).toBe(0);
    expect(stats.committedBytes).toBeLessThan(grown.committedBytes / 4);
    expect(await on.verify()).toMatchObject({ documents: 200 });
    const top = await on.collection('items').pageByIndex('byRank', { limit: 1 });
    const scanned = await on.collection('items').find({
      sorters: [{ field: 'rank', direction: 'desc' }],
      limit: 1,
      access: 'scan',
    });
    expect(top.rows).toEqual(scanned);
  });

  it('compacts without blocking writers once the connection is idle', async () => {
    const off = track(await openMemory({ autoCompact: false }));
    await churn(off, 1500);
    const grown = await off.stats();
    // A growth this large never triggers the bound, so only the idle trigger can compact.
    const db = track(await openMemory({ autoCompact: { minBytes, growth: 1000, idleMs } }));
    await churn(db, 1500);
    const stats = await settled(db);
    expect(stats.autoCompaction).toMatchObject({ state: 'idle', failures: 0 });
    expect(stats.autoCompaction.runs).toBeGreaterThan(0);
    expect(stats.committedBytes).toBeLessThan(grown.committedBytes / 4);
    expect(await db.verify()).toMatchObject({ documents: 200 });
  });

  it('compacts while another connection keeps committing', async () => {
    const backend = createMemoryBackend();
    const owner = track(
      await openDatabase(backend, { autoCompact: { minBytes, growth: 2, idleMs } }),
    );
    const writer = track(await openDatabase(backend, { autoCompact: false }));
    await churn(owner, 300);
    const other = writer.collection('items');
    for (let i = 0; i < 1500 && (await owner.stats()).autoCompaction.runs === 0; i++) {
      await other.update(i % 200, { note: 'w' + i });
      if (i % 10 === 0) await owner.collection('items').update(0, { note: 'o' + i });
    }
    const stats = await settled(owner);
    expect(stats.autoCompaction.runs).toBeGreaterThan(0);
    expect(await writer.verify()).toMatchObject({ documents: 200 });
  });

  it('closes during a background copy and reopens intact', async () => {
    const backend = createMemoryBackend();
    const db = await openDatabase(backend, { autoCompact: { minBytes, growth: 2, idleMs } });
    await churn(db, 400);
    await db.close();
    const reopened = track(await openDatabase(backend, { autoCompact: false }));
    expect(await reopened.verify()).toMatchObject({ documents: 200 });
    expect(await reopened.collection('items').count()).toBe(200);
  });

  it('does not copy the store again after a manual compaction', async () => {
    // Only the idle trigger can fire here; its threshold is 1.5 times the packed size the compactor knows.
    const db = track(
      await openMemory({ autoCompact: { minBytes: 64 * 1024, growth: 1000, idleMs: 200 } }),
    );
    const items = db.collection<{ id: number; note: string }>('items');
    await items.put({ id: 0, note: 'x' }); // the first check records a packed size of a few KiB
    await items.insertMany(
      Array.from({ length: 2000 }, (_, id) => ({ id: id + 1, note: 'y'.repeat(400) })),
    );
    await db.compact();
    await db.collect();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const stats = await settled(db);
    expect(stats.autoCompaction.runs).toBe(0);
  });

  it('compacts an idle store whose file doubled since it was packed, though it holds little garbage', async () => {
    const db = track(await openMemory({ autoCompact: { minBytes: 64 * 1024, growth: 1000, idleMs: 50 } }));
    const items = db.collection<{ id: number; note: string }>('items');
    const batch = (from: number) =>
      items.insertMany(Array.from({ length: 1000 }, (_, k) => ({ id: from + k, note: 'y'.repeat(400) })));
    await batch(0);
    await db.compact();
    await db.collect();
    const packed = (await db.stats()).committedBytes;
    // Appends in key order, one commit each: almost no garbage, so the garbage trigger (1.5 times the live size,
    // which is three times the packed size here) stays quiet, but the file grows past twice its packed size.
    await batch(1000);
    await batch(2000);
    const grown = (await db.stats()).committedBytes;
    expect(grown).toBeGreaterThan(2 * packed);
    expect(grown).toBeLessThan(1.5 * 3 * packed);
    expect((await settled(db)).autoCompaction).toMatchObject({ runs: 1, failures: 0 });
    // The copy reclaims nothing here; it reorders. Its size is the new packed size, so idling again copies nothing.
    await items.put({ id: 0, note: 'z' });
    expect((await settled(db)).autoCompaction).toMatchObject({ runs: 1, failures: 0 });
    expect(await items.count()).toBe(3000);
  });

  it('copies an insert-only load once while its growth stays below the bound', async () => {
    const load = async (db: Database) => {
      const events = db.collection('events');
      await events.createIndex({ name: 'byScore', fields: ['score'], order: ['desc'] });
      for (let i = 0; i < 10_000; i += 256)
        await events.insertMany(
          Array.from({ length: Math.min(256, 10_000 - i) }, (_, k) => ({
            id: i + k,
            score: ((i + k) * 7919) % 10_000,
            label: 'event-' + (i + k),
          })),
        );
    };
    const off = track(await openMemory({ autoCompact: false }));
    await load(off);
    const grown = (await off.stats()).committedBytes;
    await off.compact({ mode: 'exclusive' });
    // The premise: without any copy, this load leaves less than four times its live bytes.
    expect(grown / (await off.stats()).committedBytes).toBeLessThan(4);
    // idleMs far beyond the test, so only the bound can copy; the one copy at minBytes gives the bytes per entry.
    const on = track(await openMemory({ autoCompact: { minBytes, growth: 4, idleMs: 60_000 } }));
    await load(on);
    expect((await on.stats()).autoCompaction).toMatchObject({ runs: 1, failures: 0 });
    expect(await on.collection('events').count()).toBe(10_000);
  });

  it('estimates the live size from the packed size and the stored entries', () => {
    const packed = packedAt(1_000_000, 1000);
    expect(liveBytes(packed, 1000)).toBe(1_000_000);
    expect(liveBytes(packed, 3000)).toBe(3_000_000);
    expect(liveBytes(packed, 500)).toBe(500_000);
    // A tiny store's bytes per entry overstate a larger store's, so such a size is used unscaled.
    expect(liveBytes(packedAt(4096, 3), 3000)).toBe(4096);
  });

  it('rejects invalid settings before opening the store', async () => {
    await expect(openMemory({ autoCompact: { growth: 1 } })).rejects.toThrow(RangeError);
    await expect(openMemory({ autoCompact: { minBytes: -1 } })).rejects.toThrow(RangeError);
    await expect(openMemory({ autoCompact: { idleMs: 0.5 } })).rejects.toThrow(RangeError);
  });

  it('restores key order once the file doubled since it was packed, not below minBytes', () => {
    expect(layoutDue(199, 100, 0)).toBe(false);
    expect(layoutDue(200, 100, 0)).toBe(true);
    expect(layoutDue(200, 100, 300)).toBe(false);
  });

  it('becomes due at minBytes or at growth times the packed size, whichever is larger', () => {
    const settings = { minBytes: 100, growth: 2 };
    expect(compactionDue(99, 10, settings)).toBe(false);
    expect(compactionDue(100, 10, settings)).toBe(true);
    expect(compactionDue(199, 100, settings)).toBe(false);
    expect(compactionDue(200, 100, settings)).toBe(true);
  });
});
