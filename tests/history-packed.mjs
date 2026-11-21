// Executed from an independently installed npm consumer by scripts/e2e.mjs, once per server runtime.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { openDirectory } from 'defuss-db/server';
import { openMemory } from 'defuss-db';
const label = process.versions.bun ? 'bun' : 'node',
  dir = './hist-' + label;
const first = await openDirectory(dir);
await first.collection('plain').put({ id: 'a', date: new Date(99) });
await first.close();
const db = await openDirectory(dir);
// Activating history on a collection that already holds documents seeds them as its baseline.
await db.ensureCollection('plain', { $trackHistory: true });
const c = await db.ensureCollection('prices', { $trackHistory: true }),
  date = new Date(0);
const original = { id: 1n, value: 10n, bin: new Uint8Array([1, 2, 3]) };
original.self = original;
await c.at(date).put(original);
const prior = (await db.stats()).revision;
await c.at(new Date(3)).update(1n, (doc) => {
  doc.value = 20n;
  return doc;
});
await c.at(new Date(8)).delete(1n);
const pinned = await db.snapshot();
await db.compact();
await db.collect();
assert.equal((await pinned.collection('prices').at(new Date(4)).get(1n)).value, 20n);
await pinned.close();
const storeId = db.storeId;
await db.close();
const reopened = await openDirectory(dir);
await reopened.verify();
const prices = reopened.collection('prices');
assert.equal(await prices.has(1n), false);
const point = await prices.at(new Date(4), { $asOfRevision: prior }).get(1n);
assert.equal(point.value, 10n);
assert.equal(point.self, point);
const archive = await reopened.export({ history: 'full', collections: ['prices'] });
await writeFile('history-' + label + '.dfdb.br', archive);
await writeFile('history-' + label + '.json', JSON.stringify({ storeId, prior }));
await reopened.close();
const restored = await openMemory();
await restored.import(await readFile('history-' + label + '.dfdb.br'));
assert.equal(
  (
    await restored
      .collection('prices')
      .at(new Date(4), { $asOfRevision: { storeId, revision: prior } })
      .get(1n)
  ).value,
  10n,
);
await restored.verify();
await restored.close();
