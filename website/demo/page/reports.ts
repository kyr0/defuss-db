// Reports tab: one prepared DataView plan per report, evaluated by defuss-db over the 100,000 orders in the worker.
// Report columns differ, so each run builds a new Data Grid with that report's headers; the grid then sorts and
// filters only the rows the plan returned.
import { REPORTS } from '../shared/reports.js';
import { traced, type Context } from './context.js';
import { newGrid, nextFrame, onRecord } from './grid.js';
import type { Tab } from './inspector.js';
import { element, shadcn } from './shadcn.js';

export function reportsTab({ client, inspector }: Context): Tab {
  const host = element('reports-host');
  const select = element<HTMLSelectElement>('reports-plan');
  for (const [name, report] of Object.entries(REPORTS))
    select.append(new Option(report.label, name));
  let facts: [string, string | number][] = [];
  let generation = 0;

  const tab: Tab = {
    component: 'Data Grid + prepared plans',
    api: 'orders.prepareAggregate() · prepareSelect() · prepareView()',
    recordHint: 'Click a row.',
    note: 'The plan that produced the grid’s rows. A prepared plan is compiled once; every evaluate() reads a fresh committed snapshot. The result cache answers a repeated report after its second run, until an order changes.',
    trace: null,
    error: null,
    record: null,
    presets: Object.entries(REPORTS).map(([name, report]) => [
      report.label.replace(/ \(.*\)$/, ''),
      () => {
        select.value = name;
        void run();
      },
    ]),
    stats: () => facts,
    load: run,
  };

  async function run() {
    const own = ++generation;
    const name = select.value;
    const report = REPORTS[name];
    if (!report) return;
    const grid = newGrid(report.columns, report.label, 'The report returned no rows.');
    host.replaceChildren(grid);
    onRecord(grid, (record) => {
      tab.record = record;
      inspector.refresh();
    });
    await nextFrame(); // defuss-shadcn initializes grids added after load, then the skeleton paints
    const result = await traced(tab, inspector, client.call('reports.run', { name }));
    if (own !== generation) return;
    facts = result?.facts ?? [];
    if (!result) grid.dataset.emptyText = `The report failed: ${tab.error ?? ''}`;
    shadcn().dataGrid.setSource(grid, result?.rows ?? []);
    inspector.refresh();
  }

  select.addEventListener('change', () => void run());
  return tab;
}
