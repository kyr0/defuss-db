// The Accounts tab's server side: transfers between treasury accounts as transactions over two collections, the
// invariant that the balances always sum to the same total, and a pinned snapshot that keeps reading the state at
// its revision while transfers commit.
import type { Database, DatabaseSnapshot, ReadCollection } from 'defuss-db';
import { ts } from '../shared/code.js';
import type { Ops, Trace } from '../shared/protocol.js';
import type { Account, Transfer } from '../shared/records.js';
import { ACCOUNTS, random } from '../data.js';
import { plural, timed } from './trace.js';

type Result<K extends keyof Ops> = Promise<Ops[K]['result']>;
const euros = (cents: bigint) => Number(cents) / 100;
const byId = { sorters: [{ field: 'id', direction: 'asc' as const }] };

export async function seedTreasury(db: Database) {
  await db
    .collection<Transfer>('transfers')
    .createIndex({ name: 'byTime', fields: ['at'], order: ['desc'] });
  await db.collection<Account>('accounts').insertMany([...ACCOUNTS]);
}

async function total(accounts: ReadCollection<Account>): Promise<bigint> {
  const q = accounts.q;
  const { rows } = await accounts.aggregate({
    measures: { total: q.sumBigInt(q.field('balance')) },
  });
  return rows[0]?.total ?? 0n;
}

/** One transfer: both balances and the transfer record commit together. `fail` throws between the two legs. */
function transfer(db: Database, from: string, to: string, cents: bigint, fail = false) {
  return db.transaction(async (tx) => {
    const accounts = tx.collection<Account>('accounts');
    const [source, target] = await accounts.getMany([from, to]);
    if (!source || !target || from === to) throw new Error('Pick two different accounts.');
    if (cents <= 0n || source.balance < cents)
      throw new Error(`${source.name} cannot pay €${euros(cents).toFixed(2)}.`);
    await accounts.update(from, { balance: source.balance - cents });
    if (fail) throw new Error('The credit leg failed after the debit.');
    await accounts.update(to, { balance: target.balance + cents });
    await tx.collection<Transfer>('transfers').insert({ from, to, amount: cents, at: new Date() });
  });
}

const TRANSFER_CODE = (
  from: string,
  to: string,
  cents: bigint,
  fail: boolean,
) => `const { revision } = await db.transaction(async (tx) => {
  const accounts = tx.collection<Account>('accounts');
  const [from, to] = await accounts.getMany([${ts(from)}, ${ts(to)}]);
  if (!from || !to) throw new Error('Pick two different accounts.');
  if (from.balance < ${ts(cents)}) throw new Error('Insufficient funds.'); // bigint cents
  await accounts.update(from.id, { balance: from.balance - ${ts(cents)} });${
    fail
      ? `\n  throw new Error('The credit leg failed after the debit.'); // rolls back the debit too`
      : ''
  }
  await accounts.update(to.id, { balance: to.balance + ${ts(cents)} });
  await tx.collection<Transfer>('transfers').insert({
    from: from.id, to: to.id, amount: ${ts(cents)}, at: new Date(),
  });
});`;

export function treasuryApi(db: () => Promise<Database>) {
  let snapshot: DatabaseSnapshot | null = null;

  async function state(message: string, trace?: Trace): Result<'treasury.state'> {
    const store = await db();
    const accounts = store.collection<Account>('accounts');
    const [[live, sum, feed, pinnedRows, pinnedSum], ms] = await timed(() =>
      Promise.all([
        accounts.find(byId),
        total(accounts),
        store.collection<Transfer>('transfers').pageByIndex('byTime', { limit: 25 }),
        snapshot?.collection<Account>('accounts').find(byId),
        snapshot && total(snapshot.collection<Account>('accounts')),
      ]),
    );
    const pinnedBy = new Map(pinnedRows?.map((row) => [row.id, row.balance]));
    const revision = (await store.stats()).revision;
    return {
      accounts: live.map((row) => ({
        id: row.id,
        name: row.name,
        balance: euros(row.balance),
        pinned: pinnedBy.has(row.id) ? euros(pinnedBy.get(row.id)!) : null,
      })),
      transfers: feed.rows.map(({ id, from, to, amount, at }) => ({
        id,
        from,
        to,
        amount: euros(amount),
        at,
      })),
      total: String(sum),
      pinned: snapshot ? { revision: snapshot.revision, total: String(pinnedSum ?? 0n) } : null,
      revision,
      message,
      trace: trace ?? {
        what: `accounts.find() and aggregate(): ${plural(live.length, 'account')}, total ${String(sum)} cents${
          snapshot ? `; the snapshot reads revision ${snapshot.revision}` : ''
        }`,
        ms,
        code: `const live = await accounts.find(${ts(byId)});
const q = accounts.q;
const { rows: [{ total }] } = await accounts.aggregate({
  measures: { total: q.sumBigInt(q.field('balance')) }, // exact: balances are bigint cents
});
const feed = await transfers.pageByIndex('byTime', { limit: 25 }); // newest first${
          snapshot
            ? `\n// snapshot = await db.snapshot() pinned revision ${snapshot.revision}; its reads ignore later commits
const pinned = await snapshot.collection<Account>('accounts').find(${ts(byId)});`
            : ''
        }`,
      },
    };
  }

  const ops = {
    'treasury.state': () => state(''),

    async 'treasury.transfer'({
      from,
      to,
      cents,
    }: Ops['treasury.transfer']['args']): Result<'treasury.transfer'> {
      const amount = BigInt(Math.round(cents));
      const [receipt, ms] = await timed(async () => transfer(await db(), from, to, amount));
      return state(`Committed as revision ${receipt.revision}.`, {
        what: `db.transaction(): €${euros(amount).toFixed(2)} from ${from} to ${to}, revision ${receipt.revision}`,
        ms,
        code: TRANSFER_CODE(from, to, amount, false),
      });
    },

    async 'treasury.fail'({
      from,
      to,
      cents,
    }: Ops['treasury.fail']['args']): Result<'treasury.fail'> {
      const amount = BigInt(Math.round(cents));
      const store = await db();
      const before = (await store.stats()).revision;
      const [failure, ms] = await timed(() =>
        transfer(store, from, to, amount, true).then(
          () => null,
          (error: unknown) => (error instanceof Error ? error.message : String(error)),
        ),
      );
      const after = (await store.stats()).revision;
      return state(
        `Rolled back: “${failure}” Nothing was committed: revision ${before} before, ${after} after.`,
        {
          what: `db.transaction() rejected: the debit was rolled back, revision still ${after}`,
          ms,
          code: TRANSFER_CODE(from, to, amount, true),
        },
      );
    },

    async 'treasury.burst'({ count }: Ops['treasury.burst']['args']): Result<'treasury.burst'> {
      const store = await db();
      const next = random(Date.now());
      const ids = ACCOUNTS.map((account) => account.id);
      const [committed, ms] = await timed(async () => {
        let done = 0;
        for (let i = 0; i < count; i++) {
          const from = ids[Math.floor(next() * ids.length)]!;
          const to = ids.filter((id) => id !== from)[Math.floor(next() * (ids.length - 1))]!;
          // At most €500, and never more than the source holds: a refused transfer would not test the invariant.
          const balance = (await store.collection<Account>('accounts').get(from))?.balance ?? 0n;
          const cents = BigInt(Math.min(Number(balance), 100 + Math.floor(next() * 49_900)));
          if (cents <= 0n) continue;
          await transfer(store, from, to, cents);
          done++;
        }
        return done;
      });
      return state(
        `${plural(committed, 'transfer')} committed, ${(ms / Math.max(1, committed)).toFixed(1)} ms each.`,
        {
          what: `${committed} transfers, each its own db.transaction(), in sequence`,
          ms,
          code: `for (const { from, to, cents } of randomTransfers(${count})) {
  await db.transaction(async (tx) => { /* debit, credit, insert the transfer */ });
}`,
        },
      );
    },

    async 'treasury.pin'(): Result<'treasury.pin'> {
      // Forget the old snapshot first. VERIFIED: state() reads through `snapshot` whenever it is set, so a failed
      // snapshot() must not leave a closed one there.
      await closeSnapshot();
      const [pinned, ms] = await timed(async () => (await db()).snapshot());
      snapshot = pinned;
      return state(
        `Snapshot pinned at revision ${pinned.revision}. Transfers now change the live column only.`,
        {
          what: `db.snapshot(): pinned revision ${pinned.revision}`,
          ms,
          code: `const snapshot = await db.snapshot(); // revision ${pinned.revision}
const pinned = snapshot.collection<Account>('accounts');
// every read through pinned uses snapshot.revision, while writers keep committing`,
        },
      );
    },

    async 'treasury.release'(): Result<'treasury.release'> {
      const revision = snapshot?.revision;
      const [, ms] = await timed(async () => snapshot?.close());
      snapshot = null;
      return state(
        revision === undefined
          ? 'No snapshot was open.'
          : `Snapshot of revision ${revision} closed.`,
        {
          what: 'snapshot.close(): its storage generation can be reclaimed',
          ms,
          code: `await snapshot.close(); // a pinned generation stays on disk until it is closed`,
        },
      );
    },
  };
  /** Closes the pinned snapshot before the store closes or resets. */
  async function closeSnapshot() {
    await snapshot?.close();
    snapshot = null;
  }
  return { ops, closeSnapshot };
}
