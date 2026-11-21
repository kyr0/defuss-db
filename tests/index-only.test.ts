import { afterEach, expect, it } from 'vitest';
import {
  openMemory,
  createMemoryBackend,
  openDatabase,
  type Database,
  type PrimaryKey,
  type IndexPageOptions,
  type IndexPage,
  type Document,
} from '../src/index.js';
import { openDbsonl } from 'defuss-dbsonl';
import { primary, primaryFromToken } from '../src/keys.js';

const handles: Database[] = [];
afterEach(async () => {
  for (const db of handles.splice(0)) await db.close();
});
async function sample() {
  const db = await openMemory();
  handles.push(db);
  const c = db.collection<{ id: PrimaryKey; kind: string; v: Date }>('events');
  await c.createIndex({ name: 'feed', fields: ['kind', 'v'], order: ['asc', 'desc'] });
  await c.insertMany(
    Array.from({ length: 320 }, (_, n) => ({
      id: n % 3 === 0 ? BigInt(n) : n % 3 === 1 ? n : String(n),
      kind: n % 2 ? 'a' : 'b',
      v: new Date(n % 43),
    })),
  );
  return { db, c };
}

it('inverts the entire primary token domain and rejects noncanonical tokens', () => {
  for (const id of [
    '',
    '\u0000',
    '08',
    'n1',
    '\ud800😀',
    'x'.repeat(512),
    1,
    -0,
    0.0000010000000000000002,
    Number.MIN_VALUE,
    -Number.MAX_VALUE,
    1n,
    -9007199254740993n,
    10n ** 511n,
  ])
    expect(primaryFromToken(primary(id))).toBe(Object.is(id, -0) ? 0 : id);
  for (const invalid of [
    '',
    's005G',
    's0',
    's' + '0000'.repeat(513),
    'b00',
    'b-0',
    'b',
    'b1e1',
    'b' + '9'.repeat(513),
    'n-0',
    'n+1',
    'n1.0',
    'nInfinity',
    'n',
    'x0030',
  ])
    expect(() => primaryFromToken(invalid)).toThrow(expect.objectContaining({ code: 'CORRUPT' }));
});
it('compares every ID and count with full rows for tied dates, mixed IDs and changing page sizes', async () => {
  const { c } = await sample();
  for (const opt of [
    {},
    { prefix: ['a'] },
    { prefix: ['b'], gt: new Date(5), lte: new Date(27) },
    { prefix: ['missing'] },
    { prefix: ['a'], gt: new Date(40), lt: new Date(1) },
  ]) {
    const expected = (await c.pageByIndex('feed', { ...opt, limit: 1000 })).rows.map((x) => x.id);
    expect(await c.countByIndex('feed', opt)).toBe(expected.length);
    const ids: PrimaryKey[] = [];
    let cursor: string | null = null,
      n = 0;
    do {
      const o: IndexPageOptions = { ...opt, after: cursor ?? undefined, limit: n++ % 2 ? 3 : 11 };
      const page: IndexPage<PrimaryKey | Document> =
        n % 2 ? await c.pageIdsByIndex('feed', o) : await c.pageByIndex('feed', o);
      ids.push(...page.rows.map((r) => (typeof r === 'object' ? r.id : r)));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toEqual(expected);
  }
});
it('captures range inputs before waiting and honors output, scan and abort bounds', async () => {
  const { c } = await sample();
  const vals = ['a'],
    bound = new Date(2),
    opt = { prefix: vals, gt: bound };
  const expected = await c.countByIndex('feed', opt);
  const count = c.countByIndex('feed', opt),
    page = c.pageIdsByIndex('feed', { ...opt, limit: 1000 });
  vals[0] = 'z';
  bound.setTime(98);
  expect(await count).toBe(expected);
  expect((await page).rows).toHaveLength(expected);
  await expect(c.countByIndex('feed', { maxScannedEntries: 319 })).rejects.toThrow(
    'maxScannedEntries',
  );
  expect(await c.countByIndex('feed', { maxScannedEntries: 320 })).toBe(320);
  expect(await c.countByIndex('feed', { prefix: ['z'], maxScannedEntries: 0 })).toBe(0);
  await expect(c.countByIndex('feed', { maxScannedEntries: -1 })).rejects.toThrow(
    'maxScannedEntries',
  );
  await expect(c.pageIdsByIndex('feed', { maxOutputBytes: 1 })).rejects.toThrow('maxOutputBytes');
  const abort = AbortSignal.abort(new Error('stop'));
  await expect(c.countByIndex('feed', { signal: abort })).rejects.toThrow('stop');
  await expect(c.pageIdsByIndex('feed', { signal: abort })).rejects.toThrow('stop');
});
it('observes staged changes, rollback, stale cursors and pinned reads after compaction', async () => {
  const { db, c } = await sample();
  const first = await c.pageIdsByIndex('feed', { limit: 5 });
  const snap = await db.snapshot();
  try {
    const pinned = snap.collection('events');
    await expect(
      db.transaction(async (tx) => {
        const t = tx.collection('events');
        await t.delete(first.rows[0]!);
        expect(await t.countByIndex('feed')).toBe(319);
        expect((await t.pageIdsByIndex('feed', { limit: 1 })).rows[0]).not.toBe(first.rows[0]);
        throw Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await c.countByIndex('feed')).toBe(320);
    await c.delete(first.rows[0]!);
    await expect(c.pageIdsByIndex('feed', { after: first.nextCursor! })).rejects.toMatchObject({
      code: 'STALE_CURSOR',
    });
    await db.compact();
    expect(await pinned.countByIndex('feed')).toBe(320);
    expect(
      (await pinned.pageIdsByIndex('feed', { after: first.nextCursor!, limit: 1 })).rows,
    ).toHaveLength(1);
  } finally {
    await snap.close();
  }
});
it('detects a malformed ordered pointer without fetching the target document', async () => {
  const storage = createMemoryBackend(),
    db = await openDatabase(storage);
  handles.push(db);
  const c = db.collection<{ id: number; n: number }>('rows');
  await c.createIndex({ name: 'n', fields: ['n'], order: ['asc'] });
  await c.insert({ id: 1, n: 9 });
  const raw = await openDbsonl(storage, 'default');
  try {
    const rs = await raw.beginRead();
    let key = '';
    try {
      for await (const r of rs.scan({ gte: 'o:', lt: 'p:', limit: 1 })) key = r.key;
    } finally {
      await rs.close();
    }
    await raw.put(key, 'n2');
    await expect(c.countByIndex('n')).rejects.toMatchObject({ code: 'CORRUPT' });
    await expect(c.pageIdsByIndex('n')).rejects.toMatchObject({ code: 'CORRUPT' });
  } finally {
    await raw.close();
  }
});
