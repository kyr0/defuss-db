// Price history tab: a history-tracked price list read at an effective date and, optionally, as recorded up to an
// earlier revision; the selected SKU's effective segments and recorded changes; and retroactive corrections.
import type { Ops } from '../shared/protocol.js';
import { message } from './client.js';
import { traced, type Context } from './context.js';
import { onRecord } from './grid.js';
import type { Tab } from './inspector.js';
import { component, element, shadcn, type Row } from './shadcn.js';

const today = () => new Date().toISOString().slice(0, 10);

export function pricesTab({ client, inspector, wrote }: Context): Tab {
  const list = component('prices');
  const history = component('prices-history');
  const audit = component('prices-audit');
  const date = element<HTMLInputElement>('prices-date');
  const revision = element<HTMLSelectElement>('prices-revision');
  const form = element<HTMLFormElement>('prices-correct');
  const sku = element<HTMLSelectElement>('correct-sku');
  const eur = element<HTMLInputElement>('correct-eur');
  const from = element<HTMLInputElement>('correct-from');
  const until = element<HTMLInputElement>('correct-until');
  const note = element('prices-note');
  const selected = element('prices-sku');
  let revisions: Ops['prices.revisions']['result']['revisions'] = [];
  let current = 'MN-270';
  let shown = 0;

  const tab: Tab = {
    component: 'Data Grid + document history',
    api: 'prices.at(date, { $asOfRevision }) · history(id) · audit(id)',
    recordHint: 'Click a price.',
    note: 'The effective date picks the price that applied then; the recorded revision picks what the database knew at that commit. A correction is a new commit: reading with an earlier revision still returns the old answer.',
    trace: null,
    error: null,
    record: null,
    presets: [
      ['Sep 2025, latest', () => read('2025-09-01', '')],
      [
        'Sep 2025, before the correction',
        () => read('2025-09-01', String(beforeCorrection() ?? '')),
      ],
      ['Mar 2026, latest', () => read('2026-03-01', '')],
    ],
    stats: () => [
      ['Prices shown', shown],
      ['Recorded revisions', revisions.length],
      ['Effective', date.value],
      ['As of', revision.value ? `rev ${revision.value}` : 'latest'],
    ],
    async load() {
      date.max = today();
      from.max = today();
      onRecord(list, (record) => {
        tab.record = record;
        void timeline(String(record.id));
      });
      await loadRevisions();
      await Promise.all([refresh(), timeline(current)]);
    },
  };

  /** The revision just before the first seeded correction, which is the first change with an end date. */
  function beforeCorrection(): number | undefined {
    const index = revisions.findIndex((entry) => entry.label.includes(' until '));
    return index > 0 ? revisions[index - 1]?.revision : undefined;
  }

  function read(effective: string, recorded: string) {
    date.value = effective;
    revision.value = recorded;
    void refresh();
  }

  async function loadRevisions() {
    try {
      revisions = (await client.call('prices.revisions', {})).revisions;
    } catch {
      revisions = [];
    }
    const chosen = revision.value;
    revision.replaceChildren(
      new Option('Latest: everything recorded', ''),
      ...[...revisions]
        .reverse()
        .map(({ revision: value, label }) => new Option(label, String(value))),
    );
    revision.value = revisions.some((entry) => String(entry.revision) === chosen) ? chosen : '';
  }

  async function refresh() {
    const result = await traced(
      tab,
      inspector,
      client.call('prices.list', {
        date: date.value,
        revision: revision.value ? Number(revision.value) : null,
      }),
    );
    const rows = (result?.rows ?? []) as unknown as Row[];
    shown = rows.length;
    shadcn().dataGrid.setSource(list, rows);
    if (!sku.options.length)
      for (const row of rows)
        sku.append(new Option(`${String(row.id)} ${String(row.product)}`, String(row.id)));
    sku.value = current;
    inspector.refresh();
  }

  async function timeline(id: string) {
    current = id;
    sku.value = id;
    selected.textContent = id;
    const result = await traced(tab, inspector, client.call('prices.timeline', { id }));
    shadcn().dataGrid.setSource(history, (result?.history ?? []) as unknown as Row[]);
    shadcn().dataGrid.setSource(audit, (result?.audit ?? []) as unknown as Row[]);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    note.textContent = 'Recording…';
    let result: Ops['prices.correct']['result'];
    try {
      result = await client.call('prices.correct', {
        id: sku.value,
        eur: Number(eur.value),
        from: from.value,
        until: until.value || null,
      });
    } catch (error) {
      tab.error = message(error);
      note.textContent = `Not recorded: ${tab.error}`;
      inspector.refresh();
      return;
    }
    wrote();
    await loadRevisions();
    await Promise.all([refresh(), timeline(sku.value)]);
    // The correction is the call to show; the reads after it only refreshed the view, so its trace goes in last.
    tab.trace = result.trace;
    tab.error = null;
    note.textContent = `Recorded as revision ${result.revision}. Pick the revision listed below it to read the earlier answer.`;
    inspector.refresh();
  });

  date.addEventListener('change', () => void refresh());
  revision.addEventListener('change', () => void refresh());
  return tab;
}
