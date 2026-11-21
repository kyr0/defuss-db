import { performance } from 'node:perf_hooks';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { openMemory } from '../dist/index.mjs';
import { openDirectory } from '../dist/server.mjs';
const rows = 5000,
  dimensions = 64,
  repeats = 9;
const report = {
  version: JSON.parse(await readFile('package.json', 'utf8')).version,
  timestamp: new Date().toISOString(),
  runtime: process.version,
  cpu: cpus()[0]?.model,
  rows,
  dimensions,
  repeats,
  measurements: [],
};
const fixture = Array.from({ length: rows }, (_, i) => ({
  id: `${i}`.padStart(6, '0'),
  text: `Document ${i} about topic${i % 50} databases and search`,
  category: i % 50,
  vector: Float32Array.from({ length: dimensions }, (_, j) => Math.sin((i + 1) * (j + 1))),
}));
for (const backend of ['memory', 'directory']) {
  const path = await mkdtemp(join(tmpdir(), 'db-search-bench-'));
  const db =
    backend === 'memory'
      ? await openMemory({ maxTransactionOperations: 100000 })
      : await openDirectory(path, { maxTransactionOperations: 100000 });
  try {
    const c = db.collection('docs');
    await c.insertMany(fixture);
    const text = { fields: { text: { path: 'text' } } },
      vector = { path: 'vector', dimensions };
    for (const kind of ['lexical', 'vector', 'hybrid']) {
      const definition = {
        name: kind,
        kind,
        ...(kind === 'vector' ? {} : { text }),
        ...(kind === 'lexical' ? {} : { vector }),
      };
      const start = performance.now();
      await c.createSearchIndex(definition);
      const persistBuildMs = performance.now() - start;
      const query = { text: 'topic17', vector: fixture[17].vector };
      const coldStart = performance.now(),
        cold = await c.search(kind, query),
        coldMs = performance.now() - coldStart;
      if (!cold.hits.length || cold.cacheHit) throw new Error('Cold search check failed');
      const samples = [];
      for (let i = 0; i < repeats; i++) {
        const at = performance.now();
        const result = await c.search(kind, query);
        samples.push(performance.now() - at);
        if (!result.cacheHit) throw new Error('Expected cached generation');
      }
      const sorted = [...samples].sort((a, b) => a - b);
      report.measurements.push({
        backend,
        kind,
        persistBuildMs,
        coldMs,
        warmP50Ms: sorted[4],
        warmP95Ms: sorted[8],
        samplesMs: samples,
      });
    }
  } finally {
    await db.close();
    await rm(path, { recursive: true, force: true });
  }
}
await mkdir('output', { recursive: true });
await writeFile('output/benchmark-search.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
