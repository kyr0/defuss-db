// The Reports tab: each report is one prepared DataView plan over the orders collection. The worker runs `prepare`;
// the page reads `label`, `columns` and `code`. The code text is written next to the plan it shows, so a change to
// one is reviewed with the other.
import type { Collection, ComputeSummary, Page } from 'defuss-db';
import type { Filter, Sorter } from './protocol.js';
import type { Order } from './records.js';

/** [field, header, width, format]: format is a Data Grid data-format, '' for raw text, undefined for text. */
export type Column = readonly [string, string, string, string?];

/** What the worker needs from a prepared plan, whatever its row type. */
export interface Plan {
  evaluate(
    page?: Page,
    options?: { count?: 'exact' },
  ): Promise<{ rows: object[]; summary: ComputeSummary; totals?: object }>;
}

export interface Report {
  label: string;
  columns: readonly Column[];
  page?: Page;
  /** Evaluate options; default { count: 'exact' }. A view's totals already cover every matching row. */
  options?: { count?: 'exact' };
  /** The plan's filters and order, which the worker passes to orders.explain() for the access path. */
  access: { filters: Filter[]; sorters: Sorter[] };
  prepare(orders: Collection<Order>): Plan;
  /** Derives display columns from a result row, after the plan ran. */
  display?: (row: Record<string, unknown>) => Record<string, unknown>;
  code: string;
}

const money = 'currency:EUR';
const paid: Filter = { field: 'status', op: 'eq', value: 'Paid' };

export const REPORTS: Record<string, Report> = {
  regionProduct: {
    label: 'Revenue by region × product',
    columns: [
      ['region', 'Region', '7rem'],
      ['product', 'Product', '9rem'],
      ['orders', 'Orders', '7rem', 'number'],
      ['paidRevenue', 'Paid revenue', '10rem', money],
      ['averageOrder', 'Average order', '9rem', money],
      ['largest', 'Largest', '8rem', money],
    ],
    access: { filters: [], sorters: [] },
    prepare: (orders) => {
      const q = orders.q;
      return orders.prepareAggregate({
        groupBy: { region: q.field('region'), product: q.field('product') },
        measures: {
          orders: q.count(),
          paidRevenue: q.sum(q.field('amount'), {
            where: q.eq(q.field('status'), q.literal('Paid')),
          }),
          averageOrder: q.avg(q.field('amount')),
          largest: q.max(q.field('amount')),
        },
        orderBy: [{ field: 'paidRevenue', direction: 'desc' }],
      });
    },
    code: `const q = orders.q;
const plan = orders.prepareAggregate({
  groupBy: { region: q.field('region'), product: q.field('product') },
  measures: {
    orders: q.count(),
    paidRevenue: q.sum(q.field('amount'), {
      where: q.eq(q.field('status'), q.literal('Paid')),
    }),
    averageOrder: q.avg(q.field('amount')),
    largest: q.max(q.field('amount')),
  },
  orderBy: [{ field: 'paidRevenue', direction: 'desc' }],
});
const { rows, summary } = await plan.evaluate(undefined, { count: 'exact' });`,
  },
  monthly: {
    label: 'Revenue and refunds by month',
    columns: [
      ['month', 'Month', '7rem'],
      ['orders', 'Orders', '7rem', 'number'],
      ['revenue', 'Paid revenue', '10rem', money],
      ['refunded', 'Refunded', '9rem', money],
      ['refundRate', 'Refunded share', '9rem', 'percent'],
    ],
    access: { filters: [], sorters: [] },
    prepare: (orders) => {
      const q = orders.q;
      const status = (value: string) => q.eq(q.field('status'), q.literal(value));
      return orders.prepareAggregate({
        groupBy: { month: q.field('month') },
        measures: {
          orders: q.count(),
          revenue: q.sum(q.field('amount'), { where: status('Paid') }),
          refunded: q.sum(q.field('amount'), { where: status('Refunded') }),
          refundedOrders: q.count(undefined, { where: status('Refunded') }),
        },
        orderBy: [{ field: 'month', direction: 'asc' }],
      });
    },
    display: (row) => ({ ...row, refundRate: Number(row.refundedOrders) / Number(row.orders) }),
    code: `const q = orders.q;
const status = (value: Order['status']) => q.eq(q.field('status'), q.literal(value));
const plan = orders.prepareAggregate({
  groupBy: { month: q.field('month') }, // 'YYYY-MM', stored with each order
  measures: {
    orders: q.count(),
    revenue: q.sum(q.field('amount'), { where: status('Paid') }),
    refunded: q.sum(q.field('amount'), { where: status('Refunded') }),
    refundedOrders: q.count(undefined, { where: status('Refunded') }),
  },
  orderBy: [{ field: 'month', direction: 'asc' }],
});
const { rows } = await plan.evaluate(undefined, { count: 'exact' });
// refundRate = refundedOrders / orders, computed for display`,
  },
  refunds: {
    label: 'Refunds and failures by region',
    columns: [
      ['region', 'Region', '7rem'],
      ['orders', 'Orders', '7rem', 'number'],
      ['refunded', 'Refunded', '7rem', 'number'],
      ['refundedAmount', 'Refunded amount', '10rem', money],
      ['failed', 'Failed', '6rem', 'number'],
      ['pending', 'Pending', '6rem', 'number'],
    ],
    access: { filters: [], sorters: [] },
    prepare: (orders) => {
      const q = orders.q;
      const status = (value: string) => q.eq(q.field('status'), q.literal(value));
      return orders.prepareAggregate({
        groupBy: { region: q.field('region') },
        measures: {
          orders: q.count(),
          refunded: q.count(undefined, { where: status('Refunded') }),
          refundedAmount: q.sum(q.field('amount'), { where: status('Refunded') }),
          failed: q.count(undefined, { where: status('Failed') }),
          pending: q.count(undefined, { where: status('Pending') }),
        },
        orderBy: [{ field: 'refundedAmount', direction: 'desc' }],
      });
    },
    code: `const q = orders.q;
const status = (value: Order['status']) => q.eq(q.field('status'), q.literal(value));
const plan = orders.prepareAggregate({
  groupBy: { region: q.field('region') },
  measures: {
    orders: q.count(),
    refunded: q.count(undefined, { where: status('Refunded') }),
    refundedAmount: q.sum(q.field('amount'), { where: status('Refunded') }),
    failed: q.count(undefined, { where: status('Failed') }),
    pending: q.count(undefined, { where: status('Pending') }),
  },
  orderBy: [{ field: 'refundedAmount', direction: 'desc' }],
});
const { rows } = await plan.evaluate(undefined, { count: 'exact' });`,
  },
  vat: {
    label: 'Largest paid orders with VAT (projection)',
    columns: [
      ['id', 'Order', '7rem', ''],
      ['customer', 'Customer', 'minmax(11rem, 1fr)'],
      ['region', 'Region', '7rem'],
      ['net', 'Net', '9rem', money],
      ['vat', 'VAT 19 %', '8rem', money],
      ['gross', 'Gross', '9rem', money],
    ],
    page: { limit: 1_000 },
    access: { filters: [paid], sorters: [] },
    prepare: (orders) => {
      const q = orders.q;
      const net = q.field('amount');
      const gross = q.mul(net, q.literal(1.19));
      return orders.prepareSelect({
        filters: [paid],
        select: {
          id: q.field('id'),
          customer: q.field('customer'),
          region: q.field('region'),
          net,
          vat: q.sub(gross, net),
          gross,
        },
        orderBy: [{ expr: gross, direction: 'desc' }, { expr: q.field('id') }],
      });
    },
    code: `const q = orders.q;
const net = q.field('amount');
const gross = q.mul(net, q.literal(1.19));
const plan = orders.prepareSelect({
  filters: [{ field: 'status', op: 'eq', value: 'Paid' }],
  select: {
    id: q.field('id'), customer: q.field('customer'), region: q.field('region'),
    net, vat: q.sub(gross, net), gross,
  },
  orderBy: [{ expr: gross, direction: 'desc' }, { expr: q.field('id') }],
});
// the 1,000 largest paid orders; vat and gross are computed for the rows kept
const { rows, summary } = await plan.evaluate({ limit: 1_000 }, { count: 'exact' });`,
  },
  eu: {
    label: 'Newest EU orders plus totals (view)',
    columns: [
      ['id', 'Order', '7rem', ''],
      ['date', 'Date', '8rem', 'date'],
      ['customer', 'Customer', 'minmax(11rem, 1fr)'],
      ['product', 'Product', '9rem'],
      ['status', 'Status', '7.5rem'],
      ['amount', 'Amount', '9rem', money],
    ],
    page: { limit: 500 },
    options: {},
    access: {
      filters: [{ field: 'region', op: 'eq', value: 'EU' }],
      sorters: [{ field: 'date', direction: 'desc' }],
    },
    prepare: (orders) => {
      const q = orders.q;
      return orders.prepareView({
        filters: [{ field: 'region', op: 'eq', value: 'EU' }],
        select: {
          id: q.field('id'),
          date: q.field('date'),
          customer: q.field('customer'),
          product: q.field('product'),
          status: q.field('status'),
          amount: q.field('amount'),
        },
        totals: {
          orders: q.count(),
          revenue: q.sum(q.field('amount')),
          averageOrder: q.avg(q.field('amount')),
        },
        orderBy: [{ expr: q.field('date'), direction: 'desc' }],
      });
    },
    code: `const q = orders.q;
const plan = orders.prepareView({
  filters: [{ field: 'region', op: 'eq', value: 'EU' }],
  select: {
    id: q.field('id'), date: q.field('date'), customer: q.field('customer'),
    product: q.field('product'), status: q.field('status'), amount: q.field('amount'),
  },
  totals: { orders: q.count(), revenue: q.sum(q.field('amount')), averageOrder: q.avg(q.field('amount')) },
  orderBy: [{ expr: q.field('date'), direction: 'desc' }],
});
// the newest 500 EU orders, and totals over every EU order, from one snapshot
const { rows, totals } = await plan.evaluate({ limit: 500 });`,
  },
};
