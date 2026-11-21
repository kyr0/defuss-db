import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { openDirectory } from '../src/server.js';

const source = await openDirectory('./example-source');
try {
  await source.collection<{ id: string; at: Date; score: number }>('documents').put({
    id: 'example',
    at: new Date(),
    score: 42,
  });
  await pipeline(source.exportStream({ quality: 4 }), createWriteStream('./example.dfdb.br'));
} finally {
  await source.close();
}

const restored = await openDirectory('./example-restored');
try {
  console.log(
    await restored.import(createReadStream('./example.dfdb.br'), {
      mode: 'merge',
      conflicts: 'replace',
    }),
  );
  console.log(await restored.verify());
} finally {
  await restored.close();
}
