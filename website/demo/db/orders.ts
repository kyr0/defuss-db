// The Orders tab's server side: grid pages, totals and status edits over 100,000 orders.
// A grid query with the shape of the ordered index byRegionDate (region, date desc) pages by keyset cursor; any other
// query pages by offset through query(), which the planner still answers from an index where one fits.
// VERIFIED: (Chromium probe, 2026-11-20, 100,000 orders in OPFS): a pageByIndex page took 12-15 ms, a find() page at
// offset 5,000 on the same index 1.0-1.2 s, and a full-scan sort 0.5 s.
import type { Collection, Database, OrderedValue } from 'defuss-db';
import { ts } from '../shared/code.js';
import type { Filter, GridQuery, Ops, Sorter } from '../shared/protocol.js';
import type { Order, OrderEdit } from '../shared/records.js';
import { ORDER_COUNT, orderBatches } from '../data.js';
import { describeAccess, plural, timed } from './trace.js';

type Result<K extends keyof Ops> = Promise<Ops[K]['result']>;
const INDEX = 'byRegionDate';

export async function seedOrders(db: Database, progress: (done: number, total: number) => void) {
  const orders = db.collection<Order>('orders');
  // Declared before the load, so each batch maintains the index in its own commit instead of one backfill.
  await orders.createIndex({ name: INDEX, fields: ['region', 'date'], order: ['asc', 'desc'] });
  let done = 0;
  for (const batch of orderBatches()) {
    await orders.insertMany(batch);
    progress((done += batch.length), ORDER_COUNT);
  }
}

/** The grid speaks DataView's filter shapes; two fields need translating for the database. */
export function toDatabase(query: GridQuery): GridQuery {
  const filters = query.filters.map((filter): Filter => {
    // The grid's text filters are case-insensitive; DataView's contains is not, so match a lower-cased copy.
    if (filter.field === 'customer' && filter.op === 'contains')
      return { field: 'customerKey', op: 'contains', value: String(filter.value).toLowerCase() };
    if (filter.field === 'id' && filter.op === 'contains')
      return { ...filter, value: String(filter.value).toUpperCase() };
    return filter;
  });
  const sorters = query.sorters.map(
    ({ field, direction }): Sorter => ({ field, direction: direction ?? 'asc' }),
  );
  return { filters, sorters };
}

/** The index prefix when the query is exactly the index order, else null (then find() pages by offset). */
export function keyset({ filters, sorters }: GridQuery): OrderedValue[] | null {
  const byDate = (s?: Sorter) => s?.field === 'date' && s.direction === 'desc';
  const [first] = filters;
  if (filters.length === 1 && first?.field === 'region' && first.op === 'eq')
    return sorters.length === 1 && byDate(sorters[0]) ? [first.value as OrderedValue] : null;
  return !filters.length &&
    sorters.length === 2 &&
    sorters[0]?.field === 'region' &&
    sorters[0].direction === 'asc' &&
    byDate(sorters[1])
    ? []
    : null;
}

export function ordersApi(db: () => Promise<Database>) {
  const orders = async () => (await db()).collection<Order>('orders');
  return {
    async 'orders.page'({
      query,
      offset,
      limit,
      after,
    }: Ops['orders.page']['args']): Result<'orders.page'> {
      const collection = await orders();
      const request = toDatabase(query);
      const prefix = keyset(request);
      if (prefix && (offset === 0 || after)) return seek(collection, prefix, offset, limit, after);
      const find = { ...request, offset, limit };
      const [{ rows, summary }, ms] = await timed(() => collection.query(find));
      const { access } = await collection.explain(find);
      return {
        rows,
        next: null,
        trace: {
          what: `orders.query(): ${plural(rows.length, 'order')} from offset ${offset.toLocaleString('en')}, ${plural(summary.scannedRows, 'document')} scanned`,
          ms,
          access: describeAccess(access),
          code: `const { rows, summary } = await orders.query(${ts(find)});`,
        },
      };
    },

    async 'orders.count'({ query }: Ops['orders.count']['args']): Result<'orders.count'> {
      const collection = await orders();
      // countByIndex() reads only index pointers, but on the uncompacted seed it is the slower path. VERIFIED: (Chromium
      // probe, 2026-11-20): countByIndex over one region took 8.8 s there and 0.43 s after compaction; count() 0.5 s.
      const { filters } = toDatabase(query);
      const [total, ms] = await timed(() => collection.count({ filters }));
      const { access } = await collection.explain({ filters });
      return {
        total,
        trace: {
          what: `orders.count(): ${plural(total, 'order')}`,
          ms,
          access: describeAccess(access),
          code: `const total = await orders.count(${ts({ filters })});`,
        },
      };
    },

    async 'orders.setStatus'({
      id,
      status,
    }: Ops['orders.setStatus']['args']): Result<'orders.setStatus'> {
      const store = await db();
      const [receipt, ms] = await timed(() =>
        store.transaction(async (tx) => {
          const pending = tx.collection<Order>('orders');
          const order = await pending.get(id);
          if (!order) throw new Error(`No order ${id}.`);
          await pending.update(id, { status });
          await tx
            .collection<OrderEdit>('edits')
            .insert({ orderId: id, from: order.status, to: status, at: new Date() });
          return { ...order, status };
        }),
      );
      return {
        order: receipt.result,
        revision: receipt.revision,
        trace: {
          what: `db.transaction(): ${id} is ${status}, committed as revision ${receipt.revision}`,
          ms,
          access: 'primary key: one direct read',
          code: `// The order and its audit line commit together, or neither does.
const { revision } = await db.transaction(async (tx) => {
  const orders = tx.collection<Order>('orders');
  const order = await orders.get(${ts(id)});
  if (!order) throw new Error('No order ${id}.');
  await orders.update(${ts(id)}, { status: ${ts(status)} });
  await tx.collection<OrderEdit>('edits').insert({
    orderId: ${ts(id)}, from: order.status, to: ${ts(status)}, at: new Date(),
  });
});`,
        },
      };
    },

    async 'orders.edits'(): Result<'orders.edits'> {
      const edits = (await db()).collection<OrderEdit>('edits');
      const request = { sorters: [{ field: 'at', direction: 'desc' as const }], limit: 8 };
      const [rows, ms] = await timed(() => edits.find(request));
      return {
        edits: rows,
        trace: {
          what: `edits.find(): ${plural(rows.length, 'edit')}`,
          ms,
          code: `const recent = await edits.find(${ts(request)});`,
        },
      };
    },
  };
}

async function seek(
  orders: Collection<Order>,
  prefix: OrderedValue[],
  offset: number,
  limit: number,
  after: string | null,
): Result<'orders.page'> {
  const options = { ...(prefix.length ? { prefix } : {}), limit, ...(after ? { after } : {}) };
  const [page, ms] = await timed(() => orders.pageByIndex(INDEX, options));
  return {
    rows: page.rows,
    next: page.nextCursor,
    trace: {
      what: `orders.pageByIndex(): ${plural(page.rows.length, 'order')} from offset ${offset.toLocaleString('en')}`,
      ms,
      access: `ordered index ${INDEX}, keyset cursor${after ? ' from the previous page' : ''}`,
      code: `${after ? '// after: the nextCursor of the previous page, an opaque base64url token\n' : ''}const page = await orders.pageByIndex('${INDEX}', ${ts(
        {
          ...options,
          ...(after ? { after: `${after.slice(0, 16)}…` } : {}),
        },
      )});
// page.rows, then page.nextCursor for the next page (null at the end)`,
    },
  };
}
