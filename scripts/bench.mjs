import { performance } from 'node:perf_hooks';
import { cpus, tmpdir, platform, arch } from 'node:os';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openMemory } from '../dist/index.mjs';
import { openDirectory } from '../dist/server.mjs';
const rows = 20000,
  repetitions = 9;
const fixture = Array.from({ length: rows }, (_, i) => ({
  id: String(i).padStart(8, '0'),
  group: i % 100,
  amount: (i * 73) % 10000,
  at: new Date(1700000000000 + i),
  label: `Document ${i}`,
}));
const output = {
  version: JSON.parse(await readFile('package.json', 'utf8')).version,
  timestamp: new Date().toISOString(),
  runtime: process.version,
  platform: `${platform()}-${arch()}`,
  cpu: cpus()[0]?.model,
  rows,
  repetitions,
  measurements: [],
};
async function measure(backend, name, fn) {
  await fn();
  const samples = [];
  for (let i = 0; i < repetitions; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  output.measurements.push({
    backend,
    name,
    p50Ms: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samplesMs: samples,
  });
}
for (const backend of ['memory', 'directory']) {
  const directory = await mkdtemp(join(tmpdir(), 'defuss-db-bench-'));
  const options = { maxTransactionOperations: 100000, maxTransactionBytes: 128 * 1024 * 1024 };
  const db =
    backend === 'memory' ? await openMemory(options) : await openDirectory(directory, options);
  try {
    const c = db.collection('rows'),
      q = c.q;
    const start = performance.now();
    function* batches() {
      for (let at = 0; at < rows; at += 1000) yield fixture.slice(at, at + 1000);
    }
    for await (const _ of c.insertBatches(batches())) {
      /* receipts consumed to apply backpressure */
    }
    output.measurements.push({
      backend,
      name: 'insert 20000 / batches 1000',
      elapsedMs: performance.now() - start,
    });
    await c.createIndex({ name: 'group', fields: ['group'] });
    const request = {
      filters: [{ field: 'group', op: 'eq', value: 42 }],
      sorters: [{ field: 'amount', direction: 'desc' }],
      limit: 20,
    };
    const expected = fixture
      .filter((row) => row.group === 42)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);
    if (
      JSON.stringify((await c.find(request)).map((row) => row.id)) !==
      JSON.stringify(expected.map((row) => row.id))
    )
      throw new Error('Benchmark oracle differs');
    await measure(backend, '1000 sequential primary get', async () => {
      for (let i = 0; i < 1000; i++) await c.get(String((i * 17) % rows).padStart(8, '0'));
    });
    await measure(backend, 'indexed equality + top20 (200 candidates)', () => c.query(request));
    await measure(backend, 'scan equality + top20 (20000 candidates)', () =>
      c.query({ ...request, access: 'scan' }),
    );
    const aggregation = c.prepareAggregate({
      groupBy: { group: q.field('group') },
      measures: { n: q.count(), total: q.sum(q.field('amount')), mean: q.avg(q.field('amount')) },
    });
    await measure(backend, '100-group aggregate (20000 rows)', () => aggregation.evaluate());
    await measure(backend, 'stream projection (20000 rows)', async () => {
      let count = 0;
      for await (const event of c
        .prepareSelect({
          select: { id: q.field('id'), doubled: q.mul(q.field('amount'), q.literal(2)) },
        })
        .stream())
        if (event.type === 'batch') count += event.rows.length;
      if (count !== rows) throw new Error('Incomplete benchmark stream');
    });
    const physical = await db.stats();
    output.measurements.push({
      backend,
      name: 'store',
      committedBytes: physical.committedBytes,
      cacheBytes: physical.cacheBytes,
    });
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
}
await mkdir('output', { recursive: true });
await writeFile('output/benchmark.json', JSON.stringify(output, null, 2));
console.log(
  JSON.stringify(
    {
      ...output,
      measurements: output.measurements.map((measurement) => {
        const copy = { ...measurement };
        delete copy.samplesMs;
        return copy;
      }),
    },
    null,
    2,
  ),
);
