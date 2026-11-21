import { openMemory, type DatabaseSnapshot, type Document } from 'defuss-db';
import { openOPFS } from 'defuss-db/browser';

interface EventRecord extends Document {
  id: string;
  tenant: string;
  time: Date;
}
interface Article extends Document {
  id: string;
  title: string;
  vector: Float32Array;
}
interface DemoMessage {
  sequence: number;
  action:
    | 'group'
    | 'conflict'
    | 'feed'
    | 'history'
    | 'pin'
    | 'write'
    | 'release'
    | 'snapshot'
    | 'search'
    | 'archive'
    | 'increment'
    | 'reopen'
    | 'reset';
  tenant?: string;
  after?: string;
  topic?: string;
  mode?: 'lexical' | 'vector' | 'hybrid';
  effective?: 'jan10' | 'jan15' | 'jan20' | 'feb01';
  recorded?: 'original' | 'corrected';
}
const dataset = [
  ['Local database snapshots', [1, 0, 0]],
  ['Offline storage and browser workers', [0.88, 0.1, 0.02]],
  ['Native JavaScript values', [0, 1, 0]],
  ['Dates, maps and typed arrays', [0.1, 0.87, 0.03]],
  ['Hybrid search and ranking', [0, 0, 1]],
  ['Vector similarity and lexical search', [0.1, 0, 0.9]],
] as const;
const topics = {
  storage: { text: 'database storage', vector: [1, 0, 0] },
  values: { text: 'native values', vector: [0, 1, 0] },
  search: { text: 'hybrid search', vector: [0, 0, 1] },
};
async function initialize() {
  const db = await openMemory();
  const events = db.collection<EventRecord>('events');
  await events.createIndex({
    name: 'byTenant',
    fields: ['tenant', 'time'],
    order: ['asc', 'desc'],
  });
  await events.insertMany(
    Array.from({ length: 16 }, (_, i) => ({
      id: 'evt-' + String(101 + i),
      tenant: i % 2 === 0 ? 'eu' : 'us',
      time: new Date(Date.UTC(2026, 0, 1, 0, i)),
    })),
  );
  await db.collection<{ id: string; seats: number }>('balances').put({ id: 'seats', seats: 12 });
  return db;
}
let opened: ReturnType<typeof initialize> | undefined,
  snapshot: DatabaseSnapshot | undefined,
  searchReady = false;

async function priceHistory(request: DemoMessage) {
  const db = await openMemory();
  try {
    const prices = await db.ensureCollection<{ id: string; eur: number }>('prices', {
      $trackHistory: true,
    });
    await prices.at(new Date('2026-01-01T00:00:00Z')).put({ id: 'plan', eur: 100 });
    await prices.at(new Date('2026-02-01T00:00:00Z')).put({ id: 'plan', eur: 120 });
    const originalRevision = (await db.stats()).revision;
    await prices.update('plan', { eur: 110 }, { $historic: new Date('2026-01-15T00:00:00Z') });
    const correctedRevision = (await db.stats()).revision;
    const dates = {
      jan10: '2026-01-10',
      jan15: '2026-01-15',
      jan20: '2026-01-20',
      feb01: '2026-02-01',
    };
    const effective = dates[request.effective ?? 'jan20'];
    const date = new Date(effective + 'T00:00:00Z');
    const asOfRevision = request.recorded === 'corrected' ? correctedRevision : originalRevision;
    const previous = await prices.at(date, { $asOfRevision: asOfRevision }).get('plan');
    const latest = await prices.at(date).get('plan');
    const live = await prices.get('plan');
    if (!previous || !latest || !live) throw Error('The selected price was missing from history.');
    return {
      effective,
      asOfRevision,
      correctedRevision,
      amount: previous.eur,
      latestAmount: latest.eur,
      currentAmount: live.eur,
    };
  } finally {
    await db.close();
  }
}

async function execute(request: DemoMessage) {
  if (request.action === 'history') return priceHistory(request);
  if (['reopen', 'increment', 'reset'].includes(request.action)) {
    // Every button opens and closes a handle so a reload demonstrates actual OPFS persistence.
    const db = await openOPFS({ namespace: 'defuss-db-website', name: 'playground' });
    try {
      const c = db.collection<{ id: string; n: number }>('counter');
      if (request.action === 'reset') await c.delete('visits');
      if (request.action === 'increment')
        await db.transaction(async (tx) => {
          const rows = tx.collection<{ id: string; n: number }>('counter');
          const old = await rows.get('visits');
          await rows.put({ id: 'visits', n: (old?.n ?? 0) + 1 });
        });
      return { count: (await c.get('visits'))?.n ?? 0 };
    } finally {
      await db.close();
    }
  }
  const db = await (opened ??= initialize());
  const events = db.collection<EventRecord>('events');
  if (request.action === 'feed') {
    const prefix = [request.tenant === 'us' ? 'us' : 'eu'];
    const page = await events.pageIdsByIndex('byTenant', {
      prefix,
      limit: 3,
      after: request.after,
    });
    return {
      ids: page.rows,
      next: page.nextCursor,
      total: await events.countByIndex('byTenant', { prefix }),
      revision: page.revision,
    };
  }
  if (request.action === 'group') {
    const q = events.q;
    const { rows } = await events.aggregate({
      groupBy: { tenant: q.field('tenant') },
      measures: { events: q.count() },
    });
    return { rows };
  }
  if (request.action === 'search') {
    const c = db.collection<Article>('guides');
    if (!searchReady) {
      await c.insertMany(
        dataset.map(([title, v], i) => ({ id: 'g' + i, title, vector: new Float32Array(v) })),
      );
      const text = { fields: { title: { path: 'title' } } },
        vector = { path: 'vector', dimensions: 3 };
      await c.createSearchIndex({ name: 'lexical', kind: 'lexical', text });
      await c.createSearchIndex({ name: 'vector', kind: 'vector', vector });
      await c.createSearchIndex({ name: 'hybrid', kind: 'hybrid', text, vector });
      searchReady = true;
    }
    const mode = request.mode ?? 'hybrid';
    const query = topics[request.topic as keyof typeof topics] ?? topics.storage;
    const result = await c.search(mode, mode === 'lexical' ? query.text : query, { limit: 3 });
    return { hits: result.hits.map((hit) => ({ title: hit.document.title, score: hit.score })) };
  }
  if (request.action === 'archive') {
    type Sample = {
      id: string;
      time: Date;
      balance: bigint;
      bytes: Uint8Array;
      tags: Map<string, string>;
      self?: Sample;
    };
    const sample: Sample = {
      id: 'one',
      time: new Date('2026-01-01T00:00:00Z'),
      balance: 9007199254740993n,
      bytes: new Uint8Array([3, 4, 5]),
      tags: new Map([['region', 'eu']]),
    };
    sample.self = sample;
    await db.collection<Sample>('samples').put(sample);
    const archive = await db.export({ collections: ['samples'] });
    const target = await openMemory();
    try {
      await target.import(archive);
      const doc = await target.collection<Sample>('samples').get('one');
      if (!doc) throw Error('Restored document missing.');
      return {
        bytes: archive.byteLength,
        types: [
          ['Date', doc.time instanceof Date && doc.time.getTime() === sample.time.getTime()],
          ['BigInt', doc.balance === sample.balance],
          [
            'Uint8Array',
            doc.bytes instanceof Uint8Array && doc.bytes.join() === sample.bytes.join(),
          ],
          ['Map', doc.tags instanceof Map && doc.tags.get('region') === 'eu'],
          ['Cyclic reference', doc.self === doc],
        ],
      };
    } finally {
      await target.close();
    }
  }
  const live = db.collection<{ id: string; seats: number }>('balances');
  let conflict: string | undefined;
  if (request.action === 'conflict') {
    const earlier = await db.snapshot();
    try {
      await live.update('seats', (r) => ({ ...r, seats: r.seats + 1 }));
      try {
        await db.transaction(
          (tx) =>
            tx.collection<{ id: string; seats: number }>('balances').put({ id: 'seats', seats: 0 }),
          { ifRevision: earlier.revision },
        );
        throw Error('Stale write unexpectedly committed.');
      } catch (error) {
        if ((error as { code?: string }).code !== 'CONFLICT') throw error;
        conflict = 'CONFLICT';
      }
    } finally {
      await earlier.close();
    }
  }
  if (request.action === 'pin') {
    await snapshot?.close();
    snapshot = await db.snapshot();
  }
  if (request.action === 'release') {
    await snapshot?.close();
    snapshot = undefined;
  }
  if (request.action === 'write') await live.update('seats', (r) => ({ ...r, seats: r.seats + 1 }));
  return {
    conflict,
    live: (await live.get('seats'))?.seats,
    pinned: snapshot
      ? (await snapshot.collection<{ id: string; seats: number }>('balances').get('seats'))?.seats
      : null,
  };
}
// A single worker serializes demo clicks. Independent visitors and tabs have separate memory databases.
let queue = Promise.resolve();
globalThis.addEventListener('message', (event: MessageEvent<DemoMessage>) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      globalThis.postMessage({ sequence: request.sequence, value: await execute(request) });
    } catch (error) {
      globalThis.postMessage({
        sequence: request.sequence,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});
