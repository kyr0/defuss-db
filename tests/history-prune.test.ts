import { afterEach, describe, expect, it } from 'vitest';
import { openDbsonl } from 'defuss-dbsonl';
import {
  createMemoryBackend,
  openDatabase,
  openMemory,
  type Database,
  type OpenOptions,
} from '../src/index.js';
import { applyPlans, planId, prunePlan } from '../src/history-prune.js';

/**
 * Why: pruning is the one operation that deletes recorded history. It must remove exactly the versions it names,
 * leave every other read as it was, and leave a store verify() accepts after every commit, since a whole-collection
 * prune takes several.
 */
const opened: Database[] = [];
type Price = { id: string; amount: number; group?: string };
async function fixture(options?: OpenOptions) {
  const db = await openMemory(options);
  opened.push(db);
  return { db, c: await db.ensureCollection<Price>('prices', { $trackHistory: true }) };
}
afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.close()));
});
const dt = (n: number) => new Date(n);
type Prices = Awaited<ReturnType<typeof fixture>>['c'];
const versions = async (c: Prices, id: string, times: number[]) => {
  for (const t of times) await c.at(dt(t)).put({ id, amount: t });
};
const amounts = (c: Prices, id: string, times: number[]) =>
  Promise.all(times.map(async (t) => (await c.get(id, { $historic: dt(t) }))?.amount));
const timeline = async (c: Prices, id: string) =>
  (await c.history(id)).map((s) => [
    s.from.getTime(),
    s.until?.getTime() ?? null,
    s.document?.amount,
  ]);

describe('pruneHistory', () => {
  it('removes the versions that ended before the cutoff and keeps the one in effect at it', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [0, 10, 20, 30]);
    await versions(c, 'y', [0, 30]);
    // Asked twice, so the second answer may come from the query cache, which the prune must not leave behind.
    expect(await c.at(dt(5)).count()).toBe(2);
    expect(await c.at(dt(5)).count()).toBe(2);
    expect(await c.pruneHistory({ before: dt(25) })).toEqual({ documents: 1, versions: 2 });
    expect(await c.at(dt(5)).count()).toBe(1);
    expect(await amounts(c, 'x', [5, 15, 20, 25, 30])).toEqual([undefined, undefined, 20, 20, 30]);
    expect(await timeline(c, 'x')).toEqual([
      [30, null, 30],
      [20, 30, 20],
    ]);
    expect((await c.audit('x')).map((e) => e.document?.amount)).toEqual([30, 20]);
    // y's version of instant 0 was in effect at the cutoff.
    expect(await amounts(c, 'y', [0, 25, 30])).toEqual([0, 0, 30]);
    expect(await c.get('x')).toEqual({ id: 'x', amount: 30 });
    await db.verify();
    const { revision } = await db.stats();
    expect(await c.pruneHistory({ before: dt(25) })).toEqual({ documents: 0, versions: 0 });
    expect((await db.stats()).revision).toBe(revision);
  });

  it('without a cutoff keeps the current state only', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [0, 10, 20]);
    expect(await c.pruneHistory()).toEqual({ documents: 1, versions: 2 });
    expect(await timeline(c, 'x')).toEqual([[20, null, 20]]);
    await db.verify();
  });

  it('a slice in between reads as absent, and the version before it ends where it ended', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [0, 10, 20, 30, 40]);
    expect(await c.pruneHistory({ from: dt(10), before: dt(35) })).toEqual({
      documents: 1,
      versions: 2,
    });
    expect(await amounts(c, 'x', [5, 10, 25, 30, 40])).toEqual([0, undefined, undefined, 30, 40]);
    expect(await timeline(c, 'x')).toEqual([
      [40, null, 40],
      [30, 40, 30],
      [10, 30, undefined],
      [0, 10, 0],
    ]);
    await db.verify();
    const { revision } = await db.stats();
    expect(await c.pruneHistory({ from: dt(10), before: dt(35) })).toEqual({
      documents: 0,
      versions: 0,
    });
    expect((await db.stats()).revision).toBe(revision);
    // A later cutoff removes the gap with the versions around it.
    expect(await c.pruneHistory({ before: dt(40) })).toEqual({ documents: 1, versions: 2 });
    expect(await timeline(c, 'x')).toEqual([[40, null, 40]]);
    await db.verify();
  });

  it('prunes only the named ids', async () => {
    const { db, c } = await fixture();
    await versions(c, 'a', [0, 10]);
    await versions(c, 'b', [0, 10]);
    expect(await c.pruneHistory({ ids: ['a', 'a', 'missing'] })).toEqual({
      documents: 1,
      versions: 1,
    });
    expect((await c.history('a')).length).toBe(1);
    expect((await c.history('b')).length).toBe(2);
    await db.verify();
  });

  it('keeps a deleted document restorable', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [0, 10]);
    await c.at(dt(20)).delete('x');
    expect(await c.pruneHistory()).toEqual({ documents: 1, versions: 1 });
    expect(await timeline(c, 'x')).toEqual([
      [20, null, undefined],
      [10, 20, 10],
    ]);
    await db.verify();
    expect(await c.restore('x')).toBe(true);
    expect(await c.get('x')).toEqual({ id: 'x', amount: 10 });
  });

  it('keeps a version that a later bounded correction resumes', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [-10, 20]);
    await c.update('x', { amount: 30 }, { $historic: dt(0), $until: dt(8) });
    // In effect at 5: the correction. From 8 on the version of instant -10 applies again.
    expect(await c.pruneHistory({ before: dt(5) })).toEqual({ documents: 0, versions: 0 });
    expect(await amounts(c, 'x', [-5, 0, 8, 19, 20])).toEqual([-10, 30, -10, -10, 20]);
    await db.verify();
    expect(await c.pruneHistory({ before: dt(20) })).toEqual({ documents: 1, versions: 3 });
    expect(await amounts(c, 'x', [-5, 0, 8, 19, 20])).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      20,
    ]);
    await db.verify();
  });

  it('a pruned slice does not extend an owner under a temporalUnique index', async () => {
    const { db, c } = await fixture();
    await c.createIndex({ name: 'owner', fields: ['group'], temporalUnique: true });
    await c.at(dt(0)).put({ id: 'a', amount: 1, group: 'g' });
    await c.at(dt(10)).put({ id: 'a', amount: 2, group: 'h' });
    await c.at(dt(20)).put({ id: 'a', amount: 3, group: 'i' });
    await c.at(dt(15)).put({ id: 'b', amount: 4, group: 'g' });
    expect(await c.pruneHistory({ ids: ['a'], from: dt(10), before: dt(20) })).toEqual({
      documents: 1,
      versions: 1,
    });
    // verify() compares the effective intervals of every owner.
    await db.verify();
    expect((await c.get('a', { $historic: dt(16) }))?.group).toBeUndefined();
  });

  it('commits a whole collection and one long timeline in batches', async () => {
    const { db, c } = await fixture({ maxTransactionOperations: 64 });
    for (let i = 0; i < 300; i++) await versions(c, 'd' + i, [0, 10, 20]);
    const before = (await db.stats()).revision;
    expect(await c.pruneHistory()).toEqual({ documents: 300, versions: 600 });
    expect((await db.stats()).revision).toBeGreaterThan(before + 10);
    expect(await timeline(c, 'd150')).toEqual([[20, null, 20]]);
    await db.verify();
    await versions(
      c,
      'hot',
      Array.from({ length: 120 }, (_, i) => i),
    );
    // More versions than one transaction holds, behind a kept one: the gap boundary moves down with every batch.
    expect(await c.pruneHistory({ ids: ['hot'], from: dt(1) })).toEqual({
      documents: 1,
      versions: 118,
    });
    expect(await timeline(c, 'hot')).toEqual([
      [119, null, 119],
      [1, 119, undefined],
      [0, 1, 0],
    ]);
    await db.verify();
  });

  it('stays consistent while documents are written, and stops on an aborted signal', async () => {
    const { db, c } = await fixture({ maxTransactionOperations: 64 });
    const ids = Array.from({ length: 120 }, (_, i) => 'd' + i);
    for (const id of ids) await versions(c, id, [0, 10]);
    // The prune commits in batches; each update lands between two of them or makes one compute again.
    const [first] = await Promise.all([
      c.pruneHistory(),
      (async () => {
        for (const id of ids) await c.update(id, { amount: 99 });
      })(),
    ]);
    expect(first.versions).toBeGreaterThanOrEqual(120);
    await db.verify();
    await c.pruneHistory();
    for (const id of ids) expect((await timeline(c, id)).map((s) => s[2])).toEqual([99]);
    await db.verify();
    await expect(c.pruneHistory({ signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('does not stage a plan that was read before a later correction of its document', async () => {
    const backend = createMemoryBackend(),
      db = await openDatabase(backend);
    opened.push(db);
    const c = await db.ensureCollection<Price>('prices', { $trackHistory: true });
    await versions(c, 'x', [-10, 20]);
    const raw = await openDbsonl<unknown>(backend, 'default');
    try {
      const snapshot = await raw.beginRead();
      const planned = await planId(
        snapshot,
        'prices',
        prunePlan({ before: dt(20) }, false),
        'sx',
        Infinity,
        true,
      );
      await snapshot.close();
      expect(planned.versions).toBe(1);
      // This correction ends at 8, where the version of instant -10 applies again: the plan would remove its image.
      await c.update('x', { amount: 30 }, { $historic: dt(0), $until: dt(8) });
      const applied = await raw.transaction((tx) => applyPlans(tx, 'prices', [planned], true));
      expect(applied.result).toEqual({ touched: [], versions: 0, stale: ['sx'] });
      await db.verify();
      expect(await amounts(c, 'x', [-5, 0, 8, 20])).toEqual([-10, 30, -10, 20]);
    } finally {
      await raw.close();
    }
  });

  it('a full-history archive of a pruned store restores', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [0, 10, 20, 30]);
    await c.pruneHistory({ from: dt(10), before: dt(30) });
    const copy = await openMemory();
    opened.push(copy);
    await copy.import(await db.export({ history: 'full' }));
    await copy.verify();
    expect(await timeline(copy.collection<Price>('prices'), 'x')).toEqual(await timeline(c, 'x'));
  });

  it('refuses an untracked collection, a dated view and an empty range', async () => {
    const { db, c } = await fixture();
    await expect(db.collection('plain').pruneHistory()).rejects.toMatchObject({
      code: 'HISTORY_NOT_ENABLED',
    });
    await expect(db.collection('plain').pruneDeleted()).rejects.toMatchObject({
      code: 'HISTORY_NOT_ENABLED',
    });
    await expect(c.at(dt(5)).pruneHistory()).rejects.toMatchObject({ code: 'HISTORY_READ_ONLY' });
    expect(() => c.pruneHistory({ from: dt(10), before: dt(10) })).toThrow(RangeError);
    expect(() => c.pruneDeleted({ from: dt(1) } as never)).toThrow(TypeError);
  });
});

describe('pruneDeleted', () => {
  it('removes the documents deleted before the cutoff with every version', async () => {
    const { db, c } = await fixture();
    await versions(c, 'old', [0, 10]);
    await c.at(dt(20)).delete('old');
    await versions(c, 'recent', [0]);
    await c.at(dt(50)).delete('recent');
    await versions(c, 'live', [0, 10]);
    expect(await c.pruneDeleted({ before: dt(20) })).toEqual({ documents: 0, versions: 0 });
    expect(await c.pruneDeleted({ before: dt(21) })).toEqual({ documents: 1, versions: 3 });
    expect(await c.history('old')).toEqual([]);
    expect(await c.audit('old')).toEqual([]);
    expect(await c.restore('old')).toBe(false);
    expect((await c.history('recent')).length).toBe(2);
    expect((await c.history('live')).length).toBe(2);
    await db.verify();
    expect(await c.pruneDeleted({ ids: ['live', 'recent'] })).toEqual({
      documents: 1,
      versions: 2,
    });
    expect(await c.get('live')).toEqual({ id: 'live', amount: 10 });
    await db.verify();
  });

  it('erases a live document with its delete in one transaction', async () => {
    const { db, c } = await fixture();
    await versions(c, 'x', [0, 10]);
    const { result } = await db.transaction(async (tx) => {
      const prices = tx.collection<Price>('prices');
      await prices.delete('x');
      return prices.pruneDeleted({ ids: ['x'] });
    });
    expect(result).toEqual({ documents: 1, versions: 3 });
    expect(await c.history('x')).toEqual([]);
    expect(await c.get('x')).toBeUndefined();
    await db.verify();
  });

  it('removes a deleted document with more versions than one transaction holds', async () => {
    const { db, c } = await fixture({ maxTransactionOperations: 64 });
    await versions(
      c,
      'hot',
      Array.from({ length: 80 }, (_, i) => i),
    );
    await c.at(dt(100)).delete('hot');
    expect(await c.pruneDeleted()).toEqual({ documents: 1, versions: 81 });
    expect(await c.history('hot')).toEqual([]);
    await db.verify();
  });
});
