// Accounts tab: transfers between treasury accounts, each one db.transaction() over the accounts and transfers
// collections. The total of all balances is the invariant: every committed transfer and every rolled-back one leaves
// it unchanged. A pinned snapshot keeps reading the balances of its revision while transfers commit.
import type { Treasury } from '../shared/protocol.js';
import { ACCOUNTS } from '../data.js';
import { traced, type Context } from './context.js';
import { onRecord } from './grid.js';
import type { Tab } from './inspector.js';
import { component, element, shadcn, type Row } from './shadcn.js';

const EXPECTED = ACCOUNTS.reduce((sum, account) => sum + account.balance, 0n);
const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });
const cents = (text: string) => money.format(Number(BigInt(text)) / 100);
const timeCell = (el: HTMLElement, record: Row) => {
  el.textContent = record.at instanceof Date ? record.at.toLocaleTimeString('en') : '';
};

export function accountsTab({ client, inspector, wrote }: Context): Tab {
  const accounts = component('accounts');
  const transfers = component('transfers');
  const from = element<HTMLSelectElement>('tx-from');
  const to = element<HTMLSelectElement>('tx-to');
  const amount = element<HTMLInputElement>('tx-amount');
  const invariant = element('tx-invariant');
  const note = element('tx-note');
  let state: Treasury | null = null;

  const tab: Tab = {
    component: 'Data Grid + transactions',
    api: 'db.transaction(async (tx) => …) · db.snapshot()',
    recordHint: 'Click an account or a transfer.',
    note: 'A transfer debits one account, credits another and records itself in a second collection. All three writes commit as one revision or not at all; the failing transfer throws between debit and credit, and nothing of it remains.',
    trace: null,
    error: null,
    record: null,
    presets: [
      ['Transfer €250 OPS → PAY', () => void send('treasury.transfer', 'OPS', 'PAY', 25_000)],
      ['Fail after the debit', () => void send('treasury.fail', 'SAV', 'TAX', 1_000_000)],
      ['Run 25 transfers', () => void burst()],
      ['Pin snapshot', () => void show(client.call('treasury.pin', {}))],
      ['Release snapshot', () => void show(client.call('treasury.release', {}))],
    ],
    stats: () =>
      state
        ? [
            ['Accounts', state.accounts.length],
            ['Total', cents(state.total)],
            ['Invariant', BigInt(state.total) === EXPECTED ? 'holds' : 'BROKEN'],
            ['Snapshot', state.pinned ? `rev ${state.pinned.revision}` : 'none'],
          ]
        : [],
    async load() {
      for (const account of ACCOUNTS) {
        from.append(new Option(`${account.id} ${account.name}`, account.id));
        to.append(new Option(`${account.id} ${account.name}`, account.id));
      }
      to.value = 'PAY';
      onRecord(accounts, pick);
      onRecord(transfers, pick);
      await show(client.call('treasury.state', {}));
    },
  };

  function pick(record: Row) {
    tab.record = record;
    inspector.refresh();
  }

  async function show(call: Promise<Treasury>, writes = false) {
    const result = await traced(tab, inspector, call);
    if (!result) return;
    state = result;
    const live = BigInt(result.total);
    invariant.dataset.tone = live === EXPECTED ? 'ok' : 'error';
    invariant.textContent = `Sum of all balances: ${cents(result.total)} (${live.toLocaleString('en')} cents, ${
      live === EXPECTED ? 'unchanged since seeding' : 'CHANGED'
    })${result.pinned ? ` · snapshot at revision ${result.pinned.revision}: ${cents(result.pinned.total)}` : ''}`;
    note.textContent = result.message;
    accounts.dataset.pinned = result.pinned ? '' : 'none';
    shadcn().dataGrid.setSource(accounts, result.accounts as unknown as Row[]);
    shadcn().dataGrid.setSource(transfers, result.transfers as unknown as Row[], {
      cells: { at: timeCell },
    });
    if (writes) wrote();
  }

  async function send(
    op: 'treasury.transfer' | 'treasury.fail',
    source: string,
    target: string,
    value: number,
  ) {
    from.value = source;
    to.value = target;
    amount.value = (value / 100).toFixed(2);
    await show(client.call(op, { from: source, to: target, cents: value }), true);
  }

  const burst = () => show(client.call('treasury.burst', { count: 25 }), true);
  const typed = () => Math.round(Number(amount.value) * 100);

  element('tx-send').addEventListener(
    'click',
    () => void send('treasury.transfer', from.value, to.value, typed()),
  );
  element('tx-fail').addEventListener(
    'click',
    () => void send('treasury.fail', from.value, to.value, typed()),
  );
  element('tx-burst').addEventListener('click', () => void burst());
  element('tx-pin').addEventListener('click', () => void show(client.call('treasury.pin', {})));
  element('tx-release').addEventListener(
    'click',
    () => void show(client.call('treasury.release', {})),
  );
  return tab;
}
