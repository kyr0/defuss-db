import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryBackend, openDatabase, openMemory } from '../src/index.js';
import { openDbsonl } from 'defuss-dbsonl';
import type { Database, Timestamped } from '../src/index.js';

type Item = Timestamped<{ id: string; n: number; tag?: string }>;
const opened: Database[] = [];
afterEach(async () => {
  for (const db of opened.splice(0)) await db.close();
});
async function database() {
  const db = await openMemory({ autoCompact: false });
  opened.push(db);
  return db;
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 3));

describe('$timestamps', () => {
  it('stamps _createdAt and _updatedAt as Dates, one time per transaction, and keeps _createdAt', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', { $timestamps: true });
    const before = Date.now();
    await items.insertMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
    const [a, b] = await items.getMany(['a', 'b']);
    expect(a!._createdAt).toBeInstanceOf(Date);
    expect(a!._createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(a!._updatedAt).toEqual(a!._createdAt);
    expect(b!._createdAt).toEqual(a!._createdAt);
    await tick();
    await items.update('a', { n: 10 });
    const patched = (await items.get('a'))!;
    expect(patched._createdAt).toEqual(a!._createdAt);
    expect(patched._updatedAt.getTime()).toBeGreaterThan(a!._updatedAt.getTime());
    await tick();
    // A read document round-trips through put(); a callback update may return it unchanged.
    await items.put({ ...patched, n: 11 });
    await items.update('a', (current) => ({ ...current, n: 12 }));
    await items.updateMany({ filters: [{ field: 'id', op: 'eq', value: 'b' }] }, { tag: 'x' });
    const [put, many] = await items.getMany(['a', 'b']);
    expect(put).toMatchObject({ n: 12, _createdAt: a!._createdAt });
    expect(put!._updatedAt.getTime()).toBeGreaterThan(patched._updatedAt.getTime());
    expect(many).toMatchObject({ tag: 'x', _createdAt: b!._createdAt });
    for await (const step of items.insertBatches([[{ id: 'c', n: 3 }]]))
      expect(step.ids).toEqual(['c']);
    expect((await items.get('c'))!._createdAt).toBeInstanceOf(Date);
  });

  it('rejects timestamps a write sets itself, and historic writes', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', { $timestamps: true });
    await expect(
      items.insert({ id: 'a', n: 1, _createdAt: new Date(0) } as never),
    ).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    await items.insert({ id: 'a', n: 1 });
    const stored = (await items.get('a'))!;
    await expect(items.put({ ...stored, _updatedAt: new Date(1) })).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT',
    });
    await expect(items.update('a', { _createdAt: new Date(1) } as never)).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT',
    });
    await expect(
      items.update('a', (current) => ({ ...current, _createdAt: 'yesterday' as never })),
    ).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    await expect(
      items.put({ id: 'new', n: 2, _createdAt: stored._createdAt }),
    ).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    await expect(items.at(new Date(Date.now() - 1000)).put({ id: 'a', n: 3 })).rejects.toThrow();
    await expect(db.ensureCollection('items', { $timestamps: false })).rejects.toMatchObject({
      code: 'SCHEMA_MISMATCH',
    });
    await expect(db.ensureCollection('items', { $timestamps: 'yes' as never })).rejects.toThrow(
      TypeError,
    );
    expect((await items.get('a'))!.n).toBe(1);
  });

  it('keeps an ordered index on _updatedAt current, also for patches that do not name it', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', { $timestamps: true });
    await items.createIndex({ name: 'recent', fields: ['_updatedAt'], order: ['desc'] });
    await items.insertMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
    await tick();
    await items.update('a', { n: 5 });
    const page = await items.pageByIndex('recent', { limit: 1 });
    expect(page.rows.map((row) => row.id)).toEqual(['a']);
    expect(await items.countByIndex('recent', { gte: (await items.get('b'))!._updatedAt })).toBe(2);
    const q = items.q;
    const byDay = await items.aggregate({
      groupBy: { day: q.dateTrunc(q.field('_createdAt'), 'day') },
      measures: { n: q.count() },
    });
    expect(byDay.rows.reduce((sum, row) => sum + row.n, 0)).toBe(2);
    const age = q.sub(q.epochMs(q.field('_updatedAt')), q.epochMs(q.field('_createdAt')));
    const ages = await items.aggregate({ measures: { longest: q.max(age), shortest: q.min(age) } });
    const a = (await items.get('a'))!;
    expect(ages.rows).toEqual([
      { longest: a._updatedAt.getTime() - a._createdAt.getTime(), shortest: 0 },
    ]);
    expect(ages.rows[0]!.longest).toBeGreaterThan(0);
  });

  it('stamps the documents a collection held before, in batches, and resumes', async () => {
    const db = await database();
    const plain = db.collection<{ id: number; n: number }>('items');
    await plain.insertMany(Array.from({ length: 300 }, (_, id) => ({ id, n: id })));
    const before = Date.now();
    const items = await db.ensureCollection<Timestamped<{ id: number; n: number }>>('items', {
      $timestamps: true,
    });
    const all = await items.find({ limit: 1000 });
    expect(all).toHaveLength(300);
    for (const doc of all) {
      expect(doc._createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(doc._updatedAt).toEqual(doc._createdAt);
    }
    await db.ensureCollection('items', { $timestamps: true });
    expect((await items.get(0))!._createdAt).toEqual(all.find((doc) => doc.id === 0)!._createdAt);
    await db.verify();
  });

  it('resume an interrupted stamping pass, and verify() accepts unstamped documents only while it is pending', async () => {
    const backend = createMemoryBackend(),
      db = await openDatabase(backend, { maxRecordBytes: 4096, autoCompact: false });
    opened.push(db);
    const plain = db.collection<{ id: number; s?: string }>('items');
    await plain.insertMany(Array.from({ length: 300 }, (_, id) => ({ id })));
    // Grow id 299 to the record limit: it fits, but not with two more Dates. Keys sort as text, so n299 is the
    // 223rd document and fails in the second batch of 128, after the first committed.
    let size = 4096;
    // put() captures the document synchronously, so an oversized one throws before a promise exists.
    const fits = async (n: number) => {
      try {
        await plain.put({ id: 299, s: 'x'.repeat(n) });
        return true;
      } catch {
        return false;
      }
    };
    while (!(await fits(size))) size--;
    await expect(db.ensureCollection('items', { $timestamps: true })).rejects.toThrow();
    const items = db.collection<Timestamped<{ id: number; s?: string }>>('items');
    const stamped = (await items.find({ limit: 1000 })).filter((doc) => doc._createdAt).length;
    expect(stamped).toBe(128);
    await db.verify();
    await items.update(299, { s: '' });
    await db.ensureCollection('items', { $timestamps: true });
    expect((await items.find({ limit: 1000 })).every((doc) => doc._createdAt instanceof Date)).toBe(
      true,
    );
    await db.verify();
    // Finished: a document written past the API without timestamps is corruption.
    const raw = await openDbsonl(backend, 'default');
    await raw.put('d:items:sbare', { id: 'bare' });
    await expect(db.verify()).rejects.toMatchObject({ code: 'CORRUPT' });
  });

  it('let concurrent writers of different documents commit without conflicts', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', { $timestamps: true });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => items.put({ id: `k${i}`, n: i })),
    );
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
  });

  it('keep archived timestamps on import, and never move _updatedAt back', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', { $timestamps: true });
    await items.insert({ id: 'a', n: 1 });
    const original = (await items.get('a'))!;
    const archive = await db.export();
    const copy = await database();
    await copy.import(archive);
    const restored = copy.collection<Item>('items');
    expect(await restored.get('a')).toEqual(original);
    await expect(
      restored.insert({ id: 'x', n: 1, _createdAt: new Date() } as never),
    ).rejects.toMatchObject({ code: 'INVALID_DOCUMENT' });
    // A document stamped by a clock ahead of this one keeps its _updatedAt on the next write.
    const ahead = new Date(Date.now() + 3_600_000);
    const future = await database();
    await future
      .collection<Item>('items')
      .put({ id: 'f', n: 1, _createdAt: ahead, _updatedAt: ahead });
    await future.ensureCollection('items', { $timestamps: true });
    const archiveAhead = await future.export();
    const third = await database();
    await third.import(archiveAhead);
    await third.collection<Item>('items').update('f', { n: 2 });
    expect((await third.collection<Item>('items').get('f'))!._updatedAt).toEqual(ahead);
    // An ordinary collection may hold its own pair in the wrong order: turning timestamps on keeps the valid
    // _createdAt and stamps _updatedAt.
    const plain = await database();
    await plain
      .collection<Item>('items')
      .put({ id: 'o', n: 1, _createdAt: new Date(2_000), _updatedAt: new Date(1_000) });
    await plain.ensureCollection('items', { $timestamps: true });
    const fixed = (await plain.collection<Item>('items').get('o'))!;
    expect(fixed._createdAt).toEqual(new Date(2_000));
    expect(fixed._updatedAt.getTime()).toBeGreaterThan(2_000);
    await plain.verify();
  });

  it('in a tracked collection, equal the effective times history records', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', {
      $trackHistory: true,
      $timestamps: true,
    });
    await items.insert({ id: 'a', n: 1 });
    await tick();
    await items.update('a', { n: 2 });
    const doc = (await items.get('a'))!;
    const [latest, first] = await items.history('a');
    expect(doc._updatedAt).toEqual(latest!.from);
    expect(doc._createdAt).toEqual(first!.from);
  });
});

describe('restore', () => {
  it('writes back the version a delete removed, keeping its _createdAt', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', {
      $trackHistory: true,
      $timestamps: true,
    });
    await items.insert({ id: 'a', n: 1 });
    const created = (await items.get('a'))!;
    await tick();
    await items.update('a', { n: 2 });
    await tick();
    await items.delete('a');
    const [tombstone] = await items.history('a');
    expect(tombstone).toMatchObject({ document: undefined, until: null });
    expect(tombstone!.from).toBeInstanceOf(Date);
    await tick();
    // A full-history archive records the delete and the version before it in one import revision.
    const fork = await database();
    await fork.import(await db.export({ history: 'full' }));
    expect(await fork.collection<Item>('items').restore('a')).toBe(true);
    expect(await fork.collection<Item>('items').get('a')).toMatchObject({
      n: 2,
      _createdAt: created._createdAt,
    });
    expect(await items.restore('a')).toBe(true);
    const back = (await items.get('a'))!;
    expect(back).toMatchObject({ n: 2, _createdAt: created._createdAt });
    expect(back._updatedAt.getTime()).toBeGreaterThan(tombstone!.from.getTime());
    expect((await items.history('a')).map((segment) => segment.document?.n)).toEqual([
      2,
      undefined,
      2,
      1,
    ]);
    expect(await items.restore('a')).toBe(false); // live
    expect(await items.restore('never')).toBe(false);
    await expect(db.collection('plain').restore('a')).rejects.toMatchObject({
      code: 'HISTORY_NOT_ENABLED',
    });
    expect(() => items.at(new Date()).restore('a')).toThrow();
  });

  it('restores a version inserted in the same millisecond as its delete, inside a transaction', async () => {
    const db = await database();
    const items = await db.ensureCollection<Item>('items', { $trackHistory: true });
    // Memory commits take well under a millisecond; retry until an insert and its delete share one.
    let id: string | undefined;
    for (let i = 0; i < 200 && !id; i++) {
      await items.insert({ id: `k${i}`, n: i });
      await items.delete(`k${i}`);
      const [deleted, inserted] = await items.audit(`k${i}`);
      if (deleted!.from.getTime() === inserted!.from.getTime()) id = `k${i}`;
    }
    expect(id).toBeDefined();
    expect(await items.history(id!)).toHaveLength(1); // the inserted version's interval is empty
    await db.transaction(async (tx) => {
      const c = tx.collection<Item>('items');
      expect(await c.restore(id!)).toBe(true);
      await c.update(id!, { n: -1 });
    });
    expect((await items.get(id!))!.n).toBe(-1);
  });
});
