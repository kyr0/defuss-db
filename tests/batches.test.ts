import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryBackend, openDbsonl } from 'defuss-dbsonl';
import type { Backend, Dbsonl } from 'defuss-dbsonl';
import { createFileBackend } from 'defuss-dbsonl/server';
import { forRows } from 'defuss-dataview/compute';
import { PREFIX_ROWS, poolBatches, spans } from '../src/batches.js';
import { openDirectory } from '../src/server.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const run of cleanup.splice(0).reverse()) await run();
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'defuss-db-batches-'));
  cleanup.push(() => rm(path, { recursive: true, force: true }));
  return path;
}
const key = (i: number) => 'k:' + String(i).padStart(6, '0');
async function store(backend: Backend, rows: number) {
  const db: Dbsonl<{ i: number }> = await openDbsonl(backend, 'default', { create: true });
  cleanup.push(() => db.close());
  for (let i = 0; i < rows; i += 2000)
    await db.transaction((tx) => {
      for (let j = i; j < Math.min(rows, i + 2000); j++) tx.put(key(j), { i: j });
    });
  return db;
}
async function keys(db: Dbsonl<{ i: number }>, bounds: { gte?: string; lt?: string }) {
  const session = await db.beginRead();
  try {
    const seen: string[] = [];
    for await (const batch of poolBatches(session, { ...bounds, batchSize: 100 }))
      for (const row of batch) seen.push(row.key);
    return seen;
  } finally {
    await session.close();
  }
}

describe('pool batches', () => {
  it('yields every key of a range once, in order, across the bounded first scan', async () => {
    for (const rows of [PREFIX_ROWS - 1, PREFIX_ROWS, PREFIX_ROWS + 1]) {
      const db = await store(createMemoryBackend(), rows);
      expect(await keys(db, { gte: 'k:', lt: 'k;' })).toEqual(
        Array.from({ length: rows }, (_, i) => key(i)),
      );
    }
  });

  it('keeps the upper bound and matches a one-thread scan in dbsonl worker threads', async () => {
    const backend = await createFileBackend(await directory(), { scanThreshold: 100 });
    const db = await store(backend, 9000);
    const bounds = { gte: key(10), lt: key(8500) };
    expect(await keys(db, bounds)).toEqual(Array.from({ length: 8490 }, (_, i) => key(i + 10)));
  });
});

describe('measured spans', () => {
  it('splits by measured bytes in order, measuring each row once', () => {
    const measured: number[] = [];
    const sizes = [4, 4, 4, 9, 1, 1];
    const out = [
      ...spans(
        sizes.map((_, i) => i),
        (i) => (measured.push(i), sizes[i]!),
        8,
      ),
    ];
    // A row over the budget leaves alone, so DataView rejects it with LIMIT_EXCEEDED as before.
    expect(out).toEqual([[0, 1], [2], [3], [4, 5]]);
    expect(measured).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('document scans in dbsonl worker threads', () => {
  it('aggregate and first-page results equal those of one thread', async () => {
    const path = await directory();
    const results = [];
    for (const scanWorkers of [0, 4]) {
      const db = await openDirectory(path, { storage: { scanWorkers, scanThreshold: 100 }, parallel: false });
      cleanup.push(() => db.close());
      const items = db.collection<{ id: number; group: number; n: number }>('items');
      if (scanWorkers === 0)
        await items.insertMany(
          Array.from({ length: 6000 }, (_, id) => ({ id, group: id % 3, n: id })),
        );
      const q = forRows<{ id: number; group: number; n: number }>();
      const groups = await items
        .prepareAggregate({
          groupBy: { group: q.field('group') },
          measures: { count: q.count(), total: q.sum(q.field('n')) },
          orderBy: [{ field: 'group', direction: 'asc' }],
        })
        .evaluate(undefined, { cache: false });
      const first = await items
        .prepareSelect({ select: { id: q.field('id') } })
        .evaluate({ limit: 5 }, { cache: false });
      results.push({ groups, first });
      await db.close();
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[0]!.groups.rows).toEqual([
      { group: 0, count: 2000, total: 5_997_000 },
      { group: 1, count: 2000, total: 5_999_000 },
      { group: 2, count: 2000, total: 6_001_000 },
    ]);
  });
});
