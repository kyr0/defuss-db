import { openDirectory } from '../dist/server.mjs';
const [root, mode, amount = '10'] = process.argv.slice(2);
const db = await openDirectory(root);
const collection = db.collection('counter');
if (mode === 'increment') {
  for (let i = 0; i < Number(amount); i++) {
    for (;;) {
      try {
        await collection.update('main', (row) => ({ ...row, n: row.n + 1 }));
        break;
      } catch (error) {
        if (error.code !== 'CONFLICT') throw error;
      }
    }
  }
  await db.close();
} else if (mode === 'kill') {
  for (let i = 1; ; i++) {
    await db.transaction(async (tx) => {
      await tx.collection('left').put({
        id: 'v',
        n: i,
        text: `revision${i}`,
        vector: [1, i],
        payload: 'x'.repeat(128 * 1024),
      });
      await tx.collection('right').put({ id: 'v', n: i, text: `revision${i}`, vector: [1, i] });
      process.stdout.write(`staged ${i}\n`);
    });
  }
} else if (mode === 'roundtrip') {
  await collection.put({
    id: 'bun',
    n: 4,
    date: new Date(123),
    bytes: new Uint8Array([1, 2]),
    bigint: 123n,
  });
  const value = await collection.get('bun');
  if (
    value.n !== 4 ||
    value.date.getTime() !== 123 ||
    value.bigint !== 123n ||
    value.bytes[1] !== 2
  )
    throw new Error('Runtime round trip failed');
  await db.verify();
  await db.close();
} else throw new Error('Unknown process mode');
