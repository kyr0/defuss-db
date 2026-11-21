// Ledger on defuss-db: one defuss-shadcn Big Data component per tab, each answered by a real defuss-db database in a
// dedicated module worker on OPFS. The first visit seeds the store and shows its progress; later visits reopen it.
// The inspector shows the store, the active tab's figures, the TypeScript call behind its view and the selected record.
import type { Progress, StoreStatus } from './shared/protocol.js';
import { accountsTab } from './page/accounts.js';
import { createClient, message } from './page/client.js';
import type { Context } from './page/context.js';
import { createInspector, formatMs, mib, type Tab } from './page/inspector.js';
import { ordersTab } from './page/orders.js';
import { pricesTab } from './page/prices.js';
import { reportsTab } from './page/reports.js';
import { searchTab } from './page/search.js';
import { component, element } from './page/shadcn.js';

const overlay = element('seed');
const bar = element<HTMLProgressElement>('seed-bar');
const step = element('seed-step');
const chip = element('store-chip');
const number = new Intl.NumberFormat('en');

function progress(event: Progress) {
  overlay.hidden = false;
  bar.max = event.total;
  bar.value = event.done;
  step.textContent =
    event.total > 1
      ? `${event.step}: ${number.format(event.done)} of ${number.format(event.total)} · ${formatMs(event.ms)}`
      : `${event.step} · ${formatMs(event.ms)}`;
  chip.textContent = `Seeding ${event.step}`;
}

const client = createClient(new URL('./worker.js', import.meta.url), progress);
const inspector = createInspector();
let documents: Record<string, number> | null = null;

function showStore(status: StoreStatus) {
  chip.textContent = `OPFS · ${status.opened === 'seeded' ? 'seeded' : 'reopened'} · revision ${status.revision} · ${mib(status.committedBytes)}`;
  chip.dataset.opened = status.opened;
  inspector.setStore(status, documents ?? undefined);
}

async function refreshStore() {
  try {
    showStore(await client.call('store.status', {}));
  } catch (error) {
    chip.textContent = `Store unavailable: ${message(error)}`;
  }
}

async function refreshCounts() {
  try {
    documents = (await client.call('store.counts', {})).documents;
  } catch (error) {
    chip.textContent = `Document counts failed: ${message(error)}`;
    return;
  }
  await refreshStore();
}

const context: Context = {
  client,
  inspector,
  counts: () => documents,
  wrote: () => void refreshStore().then(refreshCounts),
};
const tabs: Record<string, Tab> = {
  orders: ordersTab(context),
  reports: reportsTab(context),
  prices: pricesTab(context),
  accounts: accountsTab(context),
  search: searchTab(context),
};
const loaded = new Set<string>();
let active = 'orders';
let ready = false;

function activate(name: string) {
  const tab = tabs[name];
  if (!tab) return;
  active = name;
  inspector.show(tab);
  if (!ready || loaded.has(name)) return;
  loaded.add(name);
  tab.load().catch((error: unknown) => {
    tab.error = message(error);
    inspector.refresh();
  });
}

const tablist = element('dv-tablist');
new MutationObserver(() => {
  const name = tablist.querySelector('[aria-selected="true"]')?.id.slice('tab-'.length);
  if (name && name !== active) activate(name);
}).observe(tablist, { subtree: true, attributeFilter: ['aria-selected'] });

element('reload').addEventListener('click', () => location.reload());
element('reset').addEventListener('click', async () => {
  if (!confirm('Delete the demo store from this browser and seed it again?')) return;
  ready = false;
  overlay.hidden = false;
  step.textContent = 'Closing the store';
  try {
    await client.call('store.reset', {});
    location.reload();
  } catch (error) {
    step.textContent = `Reset failed: ${message(error)}`;
  }
});

// A narrow frame keeps the inspector folded to its title bar; its own tool opens it again.
if (matchMedia('(max-width: 48rem)').matches) component('inspector').api.setState('minimized');
activate(active);

try {
  showStore(await client.call('store.status', {}));
  overlay.hidden = true;
  ready = true;
  activate(active);
  await refreshCounts();
} catch (error) {
  overlay.hidden = false;
  step.textContent = `The store could not open: ${message(error)}`;
  chip.textContent = 'Store unavailable';
}
