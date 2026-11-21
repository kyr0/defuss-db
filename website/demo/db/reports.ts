// The Reports tab's server side: runs one prepared plan from shared/reports.ts and reports how it was answered.
import type { Database } from 'defuss-db';
import type { Ops } from '../shared/protocol.js';
import type { Order } from '../shared/records.js';
import { REPORTS } from '../shared/reports.js';
import { describeAccess, plural, timed } from './trace.js';

export function reportsApi(db: () => Promise<Database>) {
  return {
    async 'reports.run'({
      name,
    }: Ops['reports.run']['args']): Promise<Ops['reports.run']['result']> {
      const report = REPORTS[name];
      if (!report) throw new Error(`No report ${name}.`);
      const store = await db();
      const orders = store.collection<Order>('orders');
      const plan = report.prepare(orders);
      const hits = store.queryCacheStats()?.hits ?? 0;
      const [result, ms] = await timed(() =>
        plan.evaluate(report.page, report.options ?? { count: 'exact' }),
      );
      const cached = (store.queryCacheStats()?.hits ?? 0) > hits;
      const { access } = await orders.explain(report.access);
      const { summary } = result;
      const totals = Object.entries(result.totals ?? {}).map(
        ([key, value]): [string, string | number] => [
          `totals.${key}`,
          typeof value === 'number' && !Number.isInteger(value)
            ? Math.round(value * 100) / 100
            : String(value),
        ],
      );
      return {
        rows: (result.rows as Record<string, unknown>[]).map(report.display ?? ((row) => row)),
        facts: [
          ['Rows returned', summary.returnedRows],
          ['Scanned', cached ? 'cache' : summary.scannedRows],
          ['Strategy', summary.strategy],
          ...totals,
        ],
        trace: {
          what: `plan.evaluate(): ${plural(summary.returnedRows, 'row')}${
            cached
              ? ' from the result cache'
              : ` after scanning ${plural(summary.scannedRows, 'order')}`
          }`,
          ms,
          access: describeAccess(access),
          code: report.code,
        },
      };
    },
  };
}
