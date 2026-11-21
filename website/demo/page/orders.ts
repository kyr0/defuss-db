// Orders tab: a Data Grid over 100,000 orders that never holds them all. The grid loads pages as it scrolls
// (data-paging="infinite"); each page comes from the worker. When the grid's sort or filters change, the page hands it
// a new loader for that query, so defuss-db answers the query and the grid only shows what it returned.
// The status column is editable: a change commits through db.transaction() and survives a reload.
import type { GridQuery, Trace } from '../shared/protocol.js';
import { STATUSES, type OrderEdit, type Status } from '../shared/records.js';
import { message } from './client.js';
import { traced, type Context } from './context.js';
import { onRecord } from './grid.js';
import { formatMs, type Tab } from './inspector.js';
import { component, shadcn, type GridConfig, type Row } from './shadcn.js';

export function ordersTab({ client, inspector, counts, wrote }: Context): Tab {
  const grid = component<GridConfig>('orders');
  let applied = '';
  let generation = 0;
  let inflight: Promise<unknown> | null = null;
  let cursors = new Map<number, string>();
  let page: Trace | null = null;
  let count: Trace | null = null;
  let total: number | null = null;
  let edits: OrderEdit[] = [];

  const tab: Tab = {
    component: 'Data Grid',
    api: 'df$.shadcn.dataGrid · setSource(el, [], { load })',
    recordHint: 'Click a row.',
    note: 'Every page of the grid is one call in the worker. A query in the index order (region, newest first) pages by keyset cursor; any other pages by offset and reports how many documents it scanned. Text filters match a lower-cased copy of the name, because DataView’s contains is case-sensitive.',
    trace: null,
    error: null,
    record: null,
    presets: [
      [
        'EU, newest first',
        () =>
          set([{ field: 'region', op: 'eq', value: 'EU' }], [{ field: 'date', direction: 'desc' }]),
      ],
      [
        'Region, then newest',
        () =>
          set(
            [],
            [
              { field: 'region', direction: 'asc' },
              { field: 'date', direction: 'desc' },
            ],
          ),
      ],
      ['Largest amounts', () => set([], [{ field: 'amount', direction: 'desc' }])],
      ['Customer “ada”', () => set([{ field: 'customer', op: 'contains', value: 'ada' }], [])],
      [
        'Refunded over €1,000',
        () =>
          set(
            [
              { field: 'status', op: 'eq', value: 'Refunded' },
              { field: 'amount', op: 'gt', value: 1000 },
            ],
            [],
          ),
      ],
      ['Reset', () => set([], [])],
    ],
    stats: () => [
      ['Orders', counts()?.orders ?? '…'],
      ['Matching', total ?? '…'],
      ['Loaded', shadcn().dataGrid.rows(grid).length],
      ['Counted in', count ? formatMs(count.ms) : '…'],
    ],
    extra: () => {
      const title = document.createElement('h3');
      title.className = 'dv-label';
      title.textContent = 'Edits, read back from the edits collection';
      if (!edits.length) {
        const hint = document.createElement('p');
        hint.className = 'dv-caption';
        hint.textContent =
          'Change a status in the grid. The order and its edit line commit in one transaction; reload the page and both are still there.';
        return [title, hint];
      }
      const list = document.createElement('ol');
      list.className = 'dv-edits';
      list.id = 'orders-edits';
      for (const edit of edits) {
        const item = document.createElement('li');
        item.textContent = `${edit.orderId}: ${edit.from} → ${edit.to}, ${edit.at.toLocaleTimeString('en')}`;
        list.append(item);
      }
      return [title, list];
    },
    async load() {
      grid.store.subscribe(() => void apply());
      onRecord(grid, (record) => {
        tab.record = record;
        inspector.refresh();
      });
      await Promise.all([apply(), loadEdits()]);
    },
  };

  function set(filters: GridConfig['filters'], sorters: GridConfig['sorters']) {
    shadcn().dataGrid.query(grid, { filters, sorters, page: 0, selected: [] });
  }

  const compose = () => {
    if (!page) return;
    tab.trace = count
      ? {
          ...page,
          access: `${page.access ?? ''}; the total: ${count.access ?? ''}`,
          code: `${page.code}\n\n// once per query, for the total\n${count.code}`,
        }
      : page;
  };

  function track<T>(promise: Promise<T>): Promise<T> {
    const tracked: Promise<T> = promise.finally(() => {
      if (inflight === tracked) inflight = null;
    });
    inflight = tracked;
    return tracked;
  }

  /** The grid's loader for one query: offset paging, or the cursor the previous page returned. */
  const loader = (own: number, query: GridQuery) => (offset: number, size: number) => {
    if (own !== generation) return Promise.resolve([]);
    return track(
      client
        .call('orders.page', { query, offset, limit: size, after: cursors.get(offset) ?? null })
        .then(({ rows, next, trace }) => {
          if (own !== generation) return [];
          if (next) cursors.set(offset + rows.length, next);
          page = trace;
          tab.error = null;
          compose();
          if (offset === 0) void countFor(own, query);
          inspector.refresh();
          return rows as unknown as Row[];
        })
        .catch((error: unknown) => {
          tab.error = message(error);
          inspector.refresh();
          return [];
        }),
    );
  };

  async function countFor(own: number, query: GridQuery) {
    try {
      const result = await client.call('orders.count', { query });
      if (own !== generation) return;
      total = result.total;
      count = result.trace;
      compose();
    } catch (error) {
      tab.error = message(error);
    }
    inspector.refresh();
  }

  /** Gives the grid a new loader when its filters or sort changed; selection and paging leave the query alone. */
  async function apply() {
    const { filters, sorters } = grid.store.value.config;
    const query: GridQuery = { filters: filters as GridQuery['filters'], sorters };
    const key = JSON.stringify(query);
    if (key === applied) return;
    applied = key;
    const own = ++generation;
    cursors = new Map();
    total = null;
    count = null;
    // A page still loading belongs to the old source; setSource waits for it, or its rows would join the new one.
    while (inflight) await inflight;
    if (own !== generation) return;
    shadcn().dataGrid.setSource(grid, [], {
      load: loader(own, query),
      cells: { status: statusCell },
    });
  }

  function statusCell(el: HTMLElement, record: Row) {
    const select = document.createElement('select');
    select.className = 'select dv-cell-select';
    select.dataset.size = 'sm';
    select.dataset.status = String(record.status).toLowerCase();
    select.setAttribute('aria-label', `Status of ${String(record.id)}`);
    for (const status of STATUSES)
      select.append(new Option(status, status, false, status === record.status));
    select.addEventListener('change', () => void setStatus(record, select));
    el.append(select);
  }

  async function setStatus(record: Row, select: HTMLSelectElement) {
    const status = select.value as Status;
    select.disabled = true;
    const result = await traced(
      tab,
      inspector,
      client.call('orders.setStatus', { id: String(record.id), status }),
    );
    select.disabled = false;
    if (!result) {
      select.value = String(record.status);
      return;
    }
    // The grid holds this record object; the next render of the row shows the committed status.
    record.status = status;
    select.dataset.status = status.toLowerCase();
    tab.record = record;
    wrote();
    await loadEdits();
  }

  async function loadEdits() {
    try {
      edits = (await client.call('orders.edits', {})).edits;
    } catch (error) {
      tab.error = message(error);
    }
    inspector.refresh();
  }

  return tab;
}
