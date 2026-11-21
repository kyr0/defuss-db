// The demo's database worker. OPFS sync access handles exist only in dedicated workers, so the page sends every
// database call here: { id, op, args } in, { id, ok, value } or { id, ok: false, error } out. The store opens on the
// first call and stays open for the worker's lifetime; calls run concurrently, as the database's own snapshots and
// transactions allow.
import type { Database } from 'defuss-db';
import { catalogApi } from './db/catalog.js';
import { ordersApi } from './db/orders.js';
import { pricesApi } from './db/prices.js';
import { reportsApi } from './db/reports.js';
import { open, type Session } from './db/store.js';
import { plural, timed } from './db/trace.js';
import { treasuryApi } from './db/treasury.js';
import type { Call, Op, Ops, Progress, Reply } from './shared/protocol.js';

const post = (message: Reply | Progress) => globalThis.postMessage(message);
let session: Promise<Session> | null = null;
const start = (fresh = false) => (session = open(post, fresh));
const current = () => session ?? start();
const db = async (): Promise<Database> => (await current()).db;
const treasury = treasuryApi(db);
const COLLECTIONS = ['orders', 'edits', 'catalog', 'prices', 'accounts', 'transfers'];

async function status(): Promise<Ops['store.status']['result']> {
  const { db: store, status: opened } = await current();
  const stats = await store.stats();
  return {
    ...opened,
    revision: stats.revision,
    storedEntries: stats.storedEntries,
    committedBytes: stats.committedBytes,
    compaction: stats.autoCompaction.state,
  };
}

type Handlers = { [K in Op]: (args: Ops[K]['args']) => Promise<Ops[K]['result']> };
const handlers: Handlers = {
  'store.status': status,
  async 'store.reset'() {
    const previous = session;
    session = null;
    await treasury.closeSnapshot();
    await (await previous?.catch(() => null))?.db.close();
    await start(true);
    return status();
  },
  async 'store.counts'() {
    const store = await db();
    const [counts, ms] = await timed(() =>
      Promise.all(COLLECTIONS.map((name) => store.collection(name).count())),
    );
    const documents = Object.fromEntries(COLLECTIONS.map((name, i) => [name, counts[i] ?? 0]));
    const sum = counts.reduce((a, b) => a + b, 0);
    return {
      documents,
      trace: {
        what: `count() on ${COLLECTIONS.length} collections: ${plural(sum, 'document')}`,
        ms,
        code: `const names = ${JSON.stringify(COLLECTIONS).replaceAll('"', "'").replaceAll(',', ', ')};
const counts = await Promise.all(names.map((name) => db.collection(name).count()));`,
      },
    };
  },
  ...ordersApi(db),
  ...reportsApi(db),
  ...pricesApi(db),
  ...treasury.ops,
  ...catalogApi(db),
};

globalThis.addEventListener('message', async (event: MessageEvent<Call>) => {
  const { id, op, args } = event.data;
  try {
    const handler = handlers[op] as (input: typeof args) => Promise<unknown>;
    post({ id, ok: true, value: await handler(args) });
  } catch (error) {
    post({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string } | null)?.code,
    });
  }
});
