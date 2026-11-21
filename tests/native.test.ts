import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { openDirectory } from '../src/server.js';
import type { Database, Document } from '../src/index.js';
const directories: string[] = [],
  opened: Database[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'defuss-db-test-'));
  directories.push(path);
  return path;
}
async function open(path: string) {
  const db = await openDirectory(path);
  opened.push(db);
  return db;
}
afterEach(async () => {
  for (const db of opened.splice(0)) await db.close();
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});
function child(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    process.stdout.on('data', (chunk) => {
      output += chunk;
    });
    process.stderr.on('data', (chunk) => {
      output += chunk;
    });
    process.on('error', reject);
    process.on('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`Child failed ${code}/${signal}: ${output}`)),
    );
  });
}
it('reopens documents, schemas and secondary indexes from a real server directory', async () => {
  const path = await directory();
  const a = await open(path);
  const c = a.collection<Document & { email: string; date: Date; map: Map<string, bigint> }>(
    'accounts',
  );
  await c.createIndex({ name: 'email', fields: ['email'], unique: true });
  await c.insert({
    id: 'one',
    email: 'a@example.test',
    date: new Date(123),
    map: new Map([['a', 1n]]),
  });
  await a.close();
  const b = await open(path);
  const values = await b
    .collection('accounts')
    .find({ filters: [{ field: 'email', op: 'eq', value: 'a@example.test' }] });
  expect(values).toEqual([
    { id: 'one', email: 'a@example.test', date: new Date(123), map: new Map([['a', 1n]]) },
  ]);
  expect((await b.stats()).durability).toBe('file-and-directory');
  expect((await b.verify()).indexEntries).toBe(1);
});
it('coordinates Node and Bun writers across processes without lost updates', async () => {
  const path = await directory(),
    db = await open(path);
  await db.collection('counter').insert({ id: 'main', n: 0 } as Document);
  await Promise.all([
    child(process.execPath, ['scripts/process.mjs', path, 'increment', '20']),
    child('bun', ['scripts/process.mjs', path, 'increment', '20']),
  ]);
  expect(await db.collection('counter').get('main')).toEqual({ id: 'main', n: 40 });
  await db.verify();
});
it('runs native binary round trips under Bun', async () => {
  const path = await directory();
  await child('bun', ['scripts/process.mjs', path, 'roundtrip']);
  const db = await open(path);
  expect(await db.collection('counter').has('bun')).toBe(true);
});
it('allows concurrent initial opens of a new logical database', async () => {
  const path = await directory();
  const both = await Promise.all([open(path), open(path)]);
  await both[0]!.collection('x').insert({ id: 1 });
  expect(await both[1]!.collection('x').has(1)).toBe(true);
});
it('recovers atomic document/index state after real writer termination', async () => {
  const path = await directory();
  let db = await open(path);
  for (const collection of ['left', 'right']) {
    const c = db.collection('' + collection);
    await c.createIndex({ name: 'n', fields: ['n'], unique: true });
    await c.createIndex({ name: 'orderN', fields: ['n'], order: ['desc'] });
    await c.createSearchIndex({
      name: 'search',
      kind: 'hybrid',
      text: { fields: { text: { path: 'text' } } },
      vector: { path: 'vector', dimensions: 2 },
    });
    await c.put({ id: 'v', n: 0, text: 'revision0', vector: [1, 0] } as Document);
  }
  await db.close();
  for (let trial = 0; trial < 4; trial++) {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(process.execPath, ['scripts/process.mjs', path, 'kill'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let killed = false,
        stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data;
      });
      proc.on('error', reject);
      proc.stdout.once('data', () => {
        setTimeout(() => {
          killed = true;
          proc.kill('SIGKILL');
        }, trial * 3);
      });
      proc.on('exit', (_code, signal) =>
        killed && signal === 'SIGKILL'
          ? resolve()
          : reject(new Error(stderr || 'Child ended before termination')),
      );
    });
    db = await open(path);
    const left = await db.collection<Document & { n: number }>('left').get('v'),
      right = await db.collection<Document & { n: number }>('right').get('v');
    expect(left?.n).toBe(right?.n);
    const audit = await db.verify();
    expect(audit.documents).toBe(2);
    expect(audit.indexEntries).toBe(6);
    for (const collection of ['left', 'right']) {
      expect(
        (await db.collection(collection).pageByIndex('orderN', { prefix: [left!.n] })).rows,
      ).toEqual([collection === 'left' ? left : right]);
      expect(
        (
          await db
            .collection(collection)
            .search('search', { text: `revision${left!.n}`, vector: [1, left!.n] })
        ).hits[0]!.id,
      ).toBe('v');
    }
    await db.compact();
    await db.collect();
    await db.close();
  }
});
