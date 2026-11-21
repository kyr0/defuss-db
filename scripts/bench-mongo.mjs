// Same-host comparison of defuss-db (directory storage, in-process) with a MongoDB server (loopback TCP).
// Both systems hold identical documents and identical indexes; every timed result is checked against the
// other system and a JavaScript oracle outside the timed interval. Writes on MongoDB run once with the
// default write concern and once journaled ({ w: 1, j: true }), because defuss-db flushes every commit.
// VERIFIED: update-one measured 0.16 ms with w: 1 and 4.0 ms with j: true against MongoDB 9.0.8, so the two differ in
// whether the journal flush is paid (docs/benchmarks/mongodb-node.json).
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, loadavg, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import { Long, MongoClient, UUID } from 'mongodb';
import { forRows } from 'defuss-dataview/compute';
import { createFileStorage } from 'defuss-storage/node';
import { openDirectory } from '../dist/server.mjs';

const log = (level, message, fields = {}) =>
  console.log(
    [new Date().toISOString(), level, message]
      .concat(Object.entries(fields).map(([k, v]) => k + '=' + v))
      .join(' '),
  );
// Config is validated once, before any connection or file is opened.
const url = process.env.MONGODB_URL;
if (!url || !/^mongodb(\+srv)?:\/\//.test(url)) {
  log('ERROR', 'MONGODB_URL must be a mongodb:// URL (see .env.example)');
  process.exit(2);
}
const sizes = (process.env.BENCH_MONGO_SIZES || '10000,100000').split(',').map(Number);
if (!sizes.every((n) => Number.isInteger(n) && n >= 1024 && n % 73 !== 0)) {
  log('ERROR', 'BENCH_MONGO_SIZES must list integers >= 1024 that are not multiples of 73');
  process.exit(2);
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const driver = JSON.parse(await readFile('node_modules/mongodb/package.json', 'utf8')).version;
const runtime = process.versions.bun ? 'Bun' : 'Node';
const fixture = {
  tenants: 64,
  regions: 16,
  tenantSelected: 7,
  pageSize: 20,
  loadBatch: 256,
  writeBatch: 64,
  concurrentWriters: 32,
  // Bulk loads per system and size; the paired rounds give the load ratio its confidence interval.
  loadRounds: 5,
};
const report = {
  version: pkg.version,
  runtime,
  runtimeVersion: process.versions.bun ?? process.version,
  mongodbDriver: driver,
  recordedAt: new Date().toISOString(),
  cpu: cpus()[0].model,
  cpuCount: cpus().length,
  memoryBytes: totalmem(),
  loadAverage: loadavg(),
  platform: process.platform,
  arch: process.arch,
  repeats: 7,
  warmups: 2,
  fixture,
  sizes,
  server: {},
  capabilities: {},
  plans: {},
  results: [],
  compaction: [],
  warm: [],
  parallel: [],
};
const median = (s) => [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)];
const dbName = `defuss_db_bench_${process.pid}_${Date.now()}`;
const temp = await mkdtemp(join(tmpdir(), 'defuss-db-mongo-'));
const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
const journaled = { writeConcern: { w: 1, j: true } };
const plain = { writeConcern: { w: 1 } };
const toMongo = ({ id, ...rest }) => ({ _id: id, ...rest });
const fromMongo = ({ _id, ...rest }) => ({ id: _id, ...rest });

// Alternates the order of paired paths every round so neither system always runs first.
async function measure(size, workload, variants, iterations = 1) {
  const observations = variants.map(() => []);
  for (let round = -report.warmups; round < report.repeats; round++) {
    const order = variants.map((_, i) => i);
    if (round % 2) order.reverse();
    for (const i of order) {
      const v = variants[i];
      const outputs = Array.from({ length: iterations });
      const start = performance.now();
      for (let n = 0; n < iterations; n++) outputs[n] = await v.run(n);
      const elapsed = (performance.now() - start) / iterations / (v.perCall ?? 1);
      for (let n = 0; n < iterations; n++) await v.check(outputs[n], n);
      if (round >= 0) observations[i].push(elapsed);
    }
  }
  for (const [i, v] of variants.entries())
    report.results.push({
      size,
      workload,
      system: v.system,
      iterations,
      ...(v.perCall ? { operationsPerCall: v.perCall } : {}),
      medianMs: median(observations[i]),
      samplesMs: observations[i],
    });
  log('INFO', 'measured', {
    size,
    workload,
    ...Object.fromEntries(variants.map((v, i) => [v.system, median(observations[i]).toFixed(3)])),
  });
}

async function compare(size) {
  const rows = Array.from({ length: size }, (_, id) => ({
    id,
    tenant: id % fixture.tenants,
    region: id % fixture.regions,
    score: (id * 73) % size,
    createdAt: new Date(Date.UTC(2026, 0, 1) + id * 1000),
    label: 'event-' + id,
  }));
  // The one-thread baseline; the parallel row uses a second handle with query workers.
  const db = await openDirectory(join(temp, 'n' + size), { parallel: false });
  const mongo = client.db(dbName).collection('events_' + size);
  try {
    const events = db.collection('events');
    await events.createIndex({
      name: 'tenant_score',
      fields: ['tenant', 'score'],
      order: ['asc', 'desc'],
    });
    await mongo.createIndex({ tenant: 1, score: -1 }, { name: 'tenant_score' });

    // defuss-db's background compaction must finish before MongoDB loads or anything is read, so neither
    // competes with it for the CPU. The report keeps how long it ran after the last commit.
    const idle = async (store) => {
      let stats = await store.stats();
      while (['running', 'waiting'].includes(stats.autoCompaction.state)) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        stats = await store.stats();
      }
      return stats;
    };
    const settle = async (n) => {
      const start = performance.now();
      const stats = await idle(db);
      const settleMs = performance.now() - start;
      report.compaction.push({
        size: n,
        settleMs,
        committedBytes: stats.committedBytes,
        ...stats.autoCompaction,
      });
      log('INFO', 'compaction settled', { size: n, ms: settleMs.toFixed(0) });
    };
    // Bulk load: one durable commit per batch on both systems. This first round fills the stores the other workloads
    // read; the later rounds run after them (below).
    const loads = { 'defuss-db': [], 'mongodb-journaled': [] };
    const load = async (system, insert) => {
      const start = performance.now();
      for (let offset = 0; offset < size; offset += fixture.loadBatch)
        await insert(rows.slice(offset, offset + fixture.loadBatch));
      const ms = performance.now() - start;
      loads[system].push(ms);
      log('INFO', 'loaded', { size, system, round: loads[system].length, ms: ms.toFixed(1) });
    };
    const loaders = (store, collection) => ({
      'defuss-db': (batch) => store.insertMany(batch),
      'mongodb-journaled': (batch) =>
        collection.insertMany(batch.map(toMongo), { ...journaled, ordered: true }),
    });
    const first = loaders(events, mongo);
    await load('defuss-db', first['defuss-db']);
    await settle(size);
    await load('mongodb-journaled', first['mongodb-journaled']);
    assert.equal(await events.count(), size);
    assert.equal(await mongo.countDocuments(), size);
    // Reads run on warm caches: each system scans the whole collection and walks the whole compound index once,
    // untimed, and the report keeps what its cache then held.
    const all = await events
      .prepareAggregate({ measures: { n: events.q.count() } })
      .evaluate(undefined, { cache: false });
    assert.equal(all.rows[0].n, size);
    assert.equal(await events.countByIndex('tenant_score', {}), size);
    const [mongoAll] = await mongo.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }]).toArray();
    assert.equal(mongoAll.n, size);
    assert.equal(
      await mongo.countDocuments({ tenant: { $gte: 0 } }, { hint: 'tenant_score' }),
      size,
    );
    const warmed = await db.stats();
    const wiredTiger = (await client.db('admin').command({ serverStatus: 1 })).wiredTiger?.cache;
    report.warm.push({
      size,
      defussCacheBytes: warmed.cacheBytes,
      defussCachePages: warmed.cachePages,
      mongodbCacheBytes: wiredTiger?.['bytes currently in the cache'] ?? null,
    });

    // Point reads: 64 different IDs per sample.
    const pick = (n) => (n * 7919) % size;
    await measure(
      size,
      'point-get',
      [
        {
          system: 'defuss-db',
          run: (n) => events.get(pick(n)),
          check: (d, n) => assert.deepEqual(d, rows[pick(n)]),
        },
        {
          system: 'mongodb',
          run: (n) => mongo.findOne({ _id: pick(n) }),
          check: (d, n) => assert.deepEqual(fromMongo(d), rows[pick(n)]),
        },
      ],
      64,
    );

    // One tenant's 20 highest scores as complete documents, served by the compound index on both systems.
    const t = fixture.tenantSelected;
    const expectedFeed = rows
      .filter((r) => r.tenant === t)
      .sort((a, b) => b.score - a.score)
      .slice(0, fixture.pageSize);
    const selection = {
      filters: [{ field: 'tenant', op: 'eq', value: t }],
      sorters: [{ field: 'score', direction: 'desc' }],
    };
    const { access } = await events.explain(selection);
    assert.equal(access.kind, 'ordered');
    const feedPlan = events.prepareFind(selection);
    const mongoFeed = () => mongo.find({ tenant: t }).sort({ score: -1 }).limit(fixture.pageSize);
    const mongoPlan = (await mongoFeed().explain()).queryPlanner.winningPlan;
    report.plans[size] = {
      defuss: access,
      mongodb: JSON.stringify(mongoPlan).match(/"stage":"[A-Z_]+"/g),
    };
    assert.ok(JSON.stringify(mongoPlan).includes('IXSCAN'));
    await measure(size, 'tenant-feed', [
      {
        system: 'defuss-db',
        run: () => feedPlan.evaluate({ limit: fixture.pageSize }, { cache: false, count: 'none' }),
        check: (r) => assert.deepEqual(r.rows, expectedFeed),
      },
      {
        system: 'defuss-db-index-page',
        run: () => events.pageByIndex('tenant_score', { prefix: [t], limit: fixture.pageSize }),
        check: (r) => assert.deepEqual(r.rows, expectedFeed),
      },
      {
        system: 'mongodb',
        run: () => mongoFeed().toArray(),
        check: (r) => assert.deepEqual(r.map(fromMongo), expectedFeed),
      },
    ]);

    // Exact count of one tenant's upper score half, answered from index entries.
    const half = Math.floor(size / 2);
    const expectedCount = rows.filter((r) => r.tenant === t && r.score >= half).length;
    await measure(size, 'range-count', [
      {
        system: 'defuss-db',
        run: () => events.countByIndex('tenant_score', { prefix: [t], gte: half }),
        check: (n) => assert.equal(n, expectedCount),
      },
      {
        system: 'mongodb',
        run: () => mongo.countDocuments({ tenant: t, score: { $gte: half } }),
        check: (n) => assert.equal(n, expectedCount),
      },
    ]);

    // Count and sum by region over every document: a full scan on both systems.
    const q = forRows();
    const expectedGroups = Array.from({ length: fixture.regions }, (_, region) => ({
      region,
      count: 0,
      score: 0,
    }));
    for (const r of rows) {
      expectedGroups[r.region].count++;
      expectedGroups[r.region].score += r.score;
    }
    const groupPlan = events.prepareAggregate({
      groupBy: { region: q.field('region') },
      measures: { count: q.count(), score: q.sum(q.field('score')) },
      orderBy: [{ field: 'region', direction: 'asc' }],
    });
    const mongoGroups = () =>
      mongo
        .aggregate([
          { $group: { _id: '$region', count: { $sum: 1 }, score: { $sum: '$score' } } },
          { $sort: { _id: 1 } },
        ])
        .toArray();
    const checkGroups = (r) => assert.deepEqual(r, expectedGroups);
    // The same aggregate on a second handle with query workers (opt-in `parallel`). Partial sums merge only under
    // exact number mode, so this plan sets it; its rows equal the one-thread plan's here, whose sums are integers.
    const startedAt = performance.now();
    const par = await openDirectory(join(temp, 'n' + size), { parallel: true, autoCompact: false });
    // The first eligible aggregate starts the workers and runs in the calling thread.
    await par.collection('events').count({}, { cache: false });
    let parallel = await par.stats();
    while (parallel.parallel.state === 'starting') {
      await new Promise((resolve) => setTimeout(resolve, 5));
      parallel = await par.stats();
    }
    assert.equal(parallel.parallel.state, 'ready', parallel.parallel.error);
    report.parallel.push({
      size,
      workers: parallel.parallel.workers,
      startMs: performance.now() - startedAt,
    });
    const parallelPlan = par.collection('events').prepareAggregate({
      groupBy: { region: q.field('region') },
      measures: { count: q.count(), score: q.sum(q.field('score')) },
      orderBy: [{ field: 'region', direction: 'asc' }],
      numberMode: 'exact',
    });
    await measure(size, 'group-totals', [
      {
        system: 'defuss-db',
        run: () => groupPlan.evaluate(undefined, { cache: false }),
        check: (r) => checkGroups(r.rows),
      },
      {
        system: 'defuss-db-parallel',
        run: () => parallelPlan.evaluate(undefined, { cache: false }),
        check: (r) => {
          assert.equal(r.summary.strategy, 'merge');
          checkGroups(r.rows);
        },
      },
      {
        system: 'mongodb',
        run: mongoGroups,
        check: (r) =>
          checkGroups(r.map(({ _id, count, score }) => ({ region: _id, count, score }))),
      },
    ]);
    await par.close();
    // The same aggregate answered from defuss-db's revision-validated result cache. MongoDB has no result cache.
    await groupPlan.evaluate(undefined, { cache: true });
    await groupPlan.evaluate(undefined, { cache: true });
    await measure(size, 'group-totals-cached', [
      {
        system: 'defuss-db',
        run: () => groupPlan.evaluate(undefined, { cache: true }),
        check: (r) => checkGroups(r.rows),
      },
    ]);

    // Single-document update, one commit per call.
    let stamp = 0;
    const target = (n) => (n * 104729) % size;
    await measure(
      size,
      'update-one',
      [
        {
          system: 'defuss-db',
          run: (n) => events.update(target(n), { tag: ++stamp }),
          check: (ok) => assert.equal(ok, true),
        },
        ...[
          ['mongodb', plain],
          ['mongodb-journaled', journaled],
        ].map(([system, options]) => ({
          system,
          run: (n) => mongo.updateOne({ _id: target(n) }, { $set: { tag: ++stamp } }, options),
          check: (r) => assert.equal(r.modifiedCount, 1),
        })),
      ],
      8,
    );

    // 32 concurrent single-document updates on distinct IDs; each call still waits for its own durable commit.
    // defuss-db publishes concurrent commits of one handle together; MongoDB groups journal flushes.
    const writers = fixture.concurrentWriters;
    await measure(
      size,
      'update-concurrent',
      [
        {
          system: 'defuss-db',
          run: (n) =>
            Promise.all(
              Array.from({ length: writers }, (_, w) =>
                events.update(target(n * writers + w), { tag: ++stamp }),
              ),
            ),
          check: (r) => assert.ok(r.every((ok) => ok === true)),
        },
        ...[
          ['mongodb', plain],
          ['mongodb-journaled', journaled],
        ].map(([system, options]) => ({
          system,
          run: (n) =>
            Promise.all(
              Array.from({ length: writers }, (_, w) =>
                mongo.updateOne(
                  { _id: target(n * writers + w) },
                  { $set: { tag: ++stamp } },
                  options,
                ),
              ),
            ),
          check: (r) => assert.ok(r.every((x) => x.modifiedCount === 1)),
        })),
      ].map((v) => ({ ...v, perCall: writers })),
      4,
    );

    // 64 new documents per commit into the indexed collection. Each system and write concern uses its own IDs.
    const next = { 'defuss-db': size, mongodb: size * 2, 'mongodb-journaled': size * 3 };
    const batch = (system) =>
      Array.from({ length: fixture.writeBatch }, () => {
        const id = next[system]++;
        return {
          id,
          tenant: id % fixture.tenants,
          region: id % fixture.regions,
          score: id,
          label: 'event-' + id,
        };
      });
    await measure(size, 'insert-batch', [
      {
        system: 'defuss-db',
        run: () => events.insertMany(batch('defuss-db')),
        check: (ids) => assert.equal(ids.length, fixture.writeBatch),
      },
      ...[
        ['mongodb', plain],
        ['mongodb-journaled', journaled],
      ].map(([system, options]) => ({
        system,
        run: () => mongo.insertMany(batch(system).map(toMongo), options),
        check: (r) => assert.equal(r.insertedCount, fixture.writeBatch),
      })),
    ]);
    await db.verify();
    // The remaining bulk-load rounds, after every other workload so they cannot disturb one: each loads a fresh store
    // and a fresh collection, and the system that loads first alternates, as in measure().
    for (let round = 1; round < fixture.loadRounds; round++) {
      const path = join(temp, `load-${size}-${round}`);
      const store = await openDirectory(path, { parallel: false });
      const collection = client.db(dbName).collection(`load_${size}_${round}`);
      try {
        const target = store.collection('events');
        await target.createIndex({
          name: 'tenant_score',
          fields: ['tenant', 'score'],
          order: ['asc', 'desc'],
        });
        await collection.createIndex({ tenant: 1, score: -1 }, { name: 'tenant_score' });
        const insert = loaders(target, collection);
        for (const system of round % 2
          ? ['mongodb-journaled', 'defuss-db']
          : ['defuss-db', 'mongodb-journaled']) {
          await load(system, insert[system]);
          if (system === 'defuss-db') await idle(store);
        }
      } finally {
        await store.close();
        await collection.drop().catch(() => {});
        await rm(path, { recursive: true, force: true });
      }
    }
    for (const [system, samplesMs] of Object.entries(loads))
      report.results.push({
        size,
        workload: 'bulk-load',
        system,
        iterations: 1,
        medianMs: median(samplesMs),
        samplesMs,
      });
  } finally {
    await db.close();
    await mongo.drop().catch(() => {});
  }
}

try {
  await client.connect();
  const admin = client.db('admin');
  const hello = await admin.command({ hello: 1 });
  const status = await admin.command({ serverStatus: 1 });
  report.server = {
    version: status.version,
    storageEngine: status.storageEngine.name,
    replicaSet: hello.setName ?? null,
    cacheBytes: status.wiredTiger?.cache?.['maximum bytes configured'] ?? null,
  };
  // Cost of one 4 KiB write plus flush through defuss-storage, the adapter defuss-db commits with, on the directory the
  // database uses. VERIFIED: defuss-storage 0.4.1 flushes with F_FULLFSYNC on macOS under Node.js and Bun; node:fs
  // under Bun issues a plain fsync (0.05 ms against 3.9 ms on macOS arm64), which defuss-db no longer pays.
  const probeStorage = await createFileStorage(temp);
  const handle = await probeStorage.open('flush-probe.bin', { create: true });
  const page = new Uint8Array(4096).fill(1);
  const flushes = [];
  for (let i = 0; i < 21; i++) {
    const start = performance.now();
    await handle.write(i * page.length, page);
    await handle.flush();
    flushes.push(performance.now() - start);
  }
  await handle.close();
  report.flushProbe = { bytes: page.length, medianMs: median(flushes) };
  log('INFO', 'connected', { mongodb: report.server.version, runtime, database: dbName });

  // Multi-document transactions: defuss-db commits two collections atomically on any backend;
  // MongoDB needs a replica set or sharded cluster for them.
  const probe = client.db(dbName).collection('txn_probe');
  await probe.insertOne({ _id: 1, n: 0 });
  // The raw command carries the transaction fields, so the server itself answers. VERIFIED: the driver's own
  // transaction API failed earlier on this standalone server with an unrelated retryable-writes message.
  try {
    await client.db(dbName).command({
      update: 'txn_probe',
      updates: [{ q: { _id: 1 }, u: { $inc: { n: 1 } } }],
      lsid: { id: new UUID() },
      txnNumber: Long.fromNumber(1),
      startTransaction: true,
      autocommit: false,
    });
    report.capabilities.mongodbMultiDocumentTransactions = { supported: true };
  } catch (error) {
    report.capabilities.mongodbMultiDocumentTransactions = {
      supported: false,
      error: String(error.message),
      code: error.codeName ?? null,
    };
  }
  const local = await openDirectory(join(temp, 'txn'));
  try {
    await local.transaction(async (tx) => {
      await tx.collection('accounts').put({ id: 'a', balance: 90 });
      await tx.collection('ledger').put({ id: 1, from: 'a', amount: 10 });
    });
    report.capabilities.defussDbMultiCollectionTransactions = {
      supported: (await local.collection('ledger').count()) === 1,
    };
  } finally {
    await local.close();
  }
  log('INFO', 'capabilities', {
    mongodbTransactions: report.capabilities.mongodbMultiDocumentTransactions.supported,
    defussTransactions: report.capabilities.defussDbMultiCollectionTransactions.supported,
  });

  for (const size of sizes) await compare(size);
  await mkdir('output', { recursive: true });
  const path = 'output/mongodb-' + runtime.toLowerCase() + '.json';
  report.loadAverageEnd = loadavg();
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  log('INFO', 'wrote report', { path, series: report.results.length });
} finally {
  await client
    .db(dbName)
    .dropDatabase()
    .catch(() => {});
  await client.close();
  await rm(temp, { recursive: true, force: true });
}
