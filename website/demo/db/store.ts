// The demo store's lifecycle in OPFS: reopen it when a complete seed is there, otherwise seed it once, and reset it on
// request. Seeding runs with automatic compaction off.
// VERIFIED: (Chromium probes, 2026-11-20, 100,000 orders with one ordered index, 4,000-5,000 per insertMany): with
// automatic compaction on, two bound compactions blocked the load for 6 s and 22 s, although the finished file
// held only 4 % garbage (112.4 MB written, 107.9 MB packed); with it off, the inserts took 1.6 s. Packing the file
// afterwards took 35-62 s, so the seed leaves it as written.
import type { Database } from 'defuss-db';
import { openOPFS } from 'defuss-db/browser';
import type { Progress, StoreStatus } from '../shared/protocol.js';
import { seedCatalog } from './catalog.js';
import { seedOrders } from './orders.js';
import { seedPrices } from './prices.js';
import { seedTreasury } from './treasury.js';
import { now, timed } from './trace.js';

export const NAMESPACE = 'defuss-db-demo';
const NAME = 'ledger';
/** Raise when the seeded data changes shape: a store with another version is replaced on the next visit. */
const SEED_VERSION = 1;
interface Seed {
  id: 'seed';
  version: number;
  seededAt: Date;
  seedMs: number;
}

const SEED_CODE = `// Bulk load: automatic compaction off, so no background copy blocks the inserts
const db = await openOPFS({ namespace: '${NAMESPACE}', name: '${NAME}', autoCompact: false });
const orders = db.collection<Order>('orders');
await orders.createIndex({
  name: 'byRegionDate', fields: ['region', 'date'], order: ['asc', 'desc'],
});
for (const batch of orderBatches(100_000, 4_000)) await orders.insertMany(batch);

const catalog = db.collection<Item>('catalog');
await catalog.createSearchIndex({ name: 'catalog', kind: 'lexical', text: { fields } });
for (const batch of catalogBatches(5_000, 1_000)) await catalog.insertMany(batch);

const prices = await db.ensureCollection<Price>('prices', { $trackHistory: true });
await db.transaction((tx) => putPriceList(tx, 2025), { $historic: new Date('2025-01-01') });
// … two more price lists, then a correction recorded later for an earlier interval

await db.collection<Account>('accounts').insertMany(accounts);
await db.close(); // the session reopens it with automatic compaction on`;

const REOPEN_CODE = `const db = await openOPFS({ namespace: '${NAMESPACE}', name: '${NAME}' });
const seed = await db.collection<Seed>('meta').get('seed'); // written last by the first visit
const { revision, storedEntries, committedBytes } = await db.stats();`;

/** Deletes the namespace's files. defuss-storage 0.4.1 keeps them in OPFS under defuss-storage/<namespace>. */
async function removeFiles() {
  const root = await navigator.storage.getDirectory();
  try {
    const base = await root.getDirectoryHandle('defuss-storage');
    await base.removeEntry(NAMESPACE, { recursive: true });
  } catch (error) {
    if ((error as DOMException).name !== 'NotFoundError') throw error;
  }
}

async function seed(progress: (event: Progress) => void): Promise<Seed> {
  const started = now();
  const report = (step: string) => (done: number, total: number) =>
    progress({ type: 'progress', step, done, total, ms: now() - started });
  const db = await openOPFS({ namespace: NAMESPACE, name: NAME, autoCompact: false });
  try {
    await seedOrders(db, report('orders'));
    await seedCatalog(db, report('catalog items'));
    report('price lists')(0, 1);
    await seedPrices(db);
    await seedTreasury(db);
    const meta: Seed = {
      id: 'seed',
      version: SEED_VERSION,
      seededAt: new Date(),
      seedMs: now() - started,
    };
    await db.collection<Seed>('meta').put(meta);
    return meta;
  } finally {
    await db.close();
  }
}

export interface Session {
  db: Database;
  status: StoreStatus;
}

/** Opens the store, seeding it first when this origin has no complete copy. */
export async function open(progress: (event: Progress) => void, fresh = false): Promise<Session> {
  let meta: Seed | undefined;
  if (!fresh) {
    const [db, openMs] = await timed(() => openOPFS({ namespace: NAMESPACE, name: NAME }));
    meta = await db.collection<Seed>('meta').get('seed');
    if (meta?.version === SEED_VERSION)
      return { db, status: await describe(db, 'reopened', openMs, meta) };
    await db.close();
  }
  // A partial seed (the tab closed mid-way) or an older version: start from empty files.
  await removeFiles();
  meta = await seed(progress);
  const [db, openMs] = await timed(() => openOPFS({ namespace: NAMESPACE, name: NAME }));
  return { db, status: await describe(db, 'seeded', openMs, meta) };
}

export async function describe(
  db: Database,
  opened: StoreStatus['opened'],
  openMs: number,
  meta: Seed,
): Promise<StoreStatus> {
  const stats = await db.stats();
  return {
    opened,
    openMs,
    seedMs: opened === 'seeded' ? meta.seedMs : null,
    seededAt: meta.seededAt,
    revision: stats.revision,
    storedEntries: stats.storedEntries,
    committedBytes: stats.committedBytes,
    compaction: stats.autoCompaction.state,
    trace: {
      what:
        opened === 'seeded'
          ? `Seeded in ${(meta.seedMs / 1000).toFixed(1)} s, then reopened in ${openMs.toFixed(1)} ms`
          : `openOPFS(): reopened the store seeded ${meta.seededAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      ms: opened === 'seeded' ? meta.seedMs : openMs,
      code: opened === 'seeded' ? SEED_CODE : REOPEN_CODE,
    },
  };
}

export async function seededMeta(db: Database): Promise<Seed> {
  const meta = await db.collection<Seed>('meta').get('seed');
  if (!meta) throw new Error('The store lost its seed record.');
  return meta;
}
