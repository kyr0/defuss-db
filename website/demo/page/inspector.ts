// The inspector on the right: the store's state, the active tab's figures and example queries, the TypeScript call
// behind its view with the measured time and access plan, and the selected record.
import type { StoreStatus, Trace } from '../shared/protocol.js';
import { codeLines } from './highlight.js';
import { element, shadcn, type Row } from './shadcn.js';

export interface Tab {
  component: string;
  api: string;
  recordHint: string;
  /** The caption under the code panel. */
  note: string;
  presets: [label: string, run: () => void][];
  stats(): [string, string | number][];
  /** Extra inspector content for this tab, such as the Orders tab's persisted edits. */
  extra?(): Node[];
  /** Called once, when the tab is first shown. */
  load(): Promise<void>;
  trace: Trace | null;
  error: string | null;
  record: Row | null;
}

const number = new Intl.NumberFormat('en');
export const formatMs = (ms: number) =>
  ms >= 1000
    ? `${(ms / 1000).toFixed(1)} s`
    : `${ms < 10 ? ms.toFixed(1) : number.format(Math.round(ms))} ms`;
export const mib = (bytes: number) => `${(bytes / 2 ** 20).toFixed(1)} MiB`;

function statistic(title: string, value: string | number): HTMLElement {
  const box = document.createElement('div');
  box.className = 'statistic';
  const label = document.createElement('p');
  label.className = 'statistic-title';
  label.textContent = title;
  const figure = document.createElement('p');
  figure.className = 'statistic-value';
  figure.textContent = typeof value === 'number' ? number.format(value) : value;
  box.append(label, figure);
  return box;
}

/** A record as plain JSON for the Property Grid: Dates as ISO text, bigints as digits with n. */
function displayable(record: Row): Row {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? `${value}n` : value,
    ]),
  );
}

export function createInspector() {
  const parts = {
    component: element('ins-component'),
    api: element('ins-api'),
    store: element('ins-store'),
    stats: element('ins-stats'),
    ms: element('ins-ms'),
    what: element('ins-ms-what'),
    access: element('ins-access'),
    presets: element('ins-presets'),
    extra: element('ins-extra'),
    code: element('ins-code'),
    note: element('ins-note'),
    record: element('ins-record'),
  };
  let active: Tab | null = null;
  let store: StoreStatus | null = null;
  let documents: Record<string, number> | null = null;
  let frame = 0;

  function renderStore() {
    if (!store) return;
    const line = document.createElement('p');
    line.className = 'dv-store-line';
    const lead = document.createElement('strong');
    lead.textContent =
      store.opened === 'seeded' ? 'Seeded into OPFS on this visit' : 'Reopened from OPFS';
    line.append(
      lead,
      store.opened === 'seeded'
        ? ` in ${formatMs(store.seedMs ?? 0)}, then opened in ${formatMs(store.openMs)}.`
        : ` in ${formatMs(store.openMs)}, without seeding. Seeded ${store.seededAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    );
    const facts = document.createElement('div');
    facts.className = 'dv-stats';
    facts.append(
      statistic('Revision', store.revision),
      statistic('Documents', documents ? Object.values(documents).reduce((a, b) => a + b, 0) : '…'),
      statistic('Stored entries', store.storedEntries),
      statistic('Committed', mib(store.committedBytes)),
    );
    parts.store.replaceChildren(line, facts);
    if (documents) {
      const list = document.createElement('p');
      list.className = 'dv-caption';
      list.textContent = Object.entries(documents)
        .map(([name, count]) => `${name} ${number.format(count)}`)
        .join(' · ');
      parts.store.append(list);
    }
  }

  function render() {
    renderStore();
    const tab = active;
    if (!tab) return;
    parts.stats.replaceChildren(...tab.stats().map(([title, value]) => statistic(title, value)));
    parts.extra.replaceChildren(...(tab.extra?.() ?? []));
    if (tab.error) {
      parts.ms.textContent = 'Failed';
      parts.what.textContent = tab.error;
      parts.what.dataset.tone = 'error';
    } else {
      parts.ms.textContent = tab.trace ? formatMs(tab.trace.ms) : '–';
      parts.what.textContent = tab.trace?.what ?? 'Waiting for the first call.';
      delete parts.what.dataset.tone;
    }
    parts.access.textContent = tab.trace?.access ? `Access: ${tab.trace.access}` : '';
    parts.code.replaceChildren(
      ...codeLines(tab.trace?.code ?? '// The call appears here once it ran.'),
    );
    shadcn().propertyGrid.configure(parts.record, {
      source: tab.record ? displayable(tab.record) : {},
    });
  }

  return {
    /** Re-renders on the next frame; many calls in one frame render once. */
    refresh() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    },
    show(tab: Tab) {
      active = tab;
      parts.component.textContent = tab.component;
      parts.api.textContent = tab.api;
      parts.note.textContent = tab.note;
      parts.record.dataset.emptyText = tab.recordHint;
      parts.presets.replaceChildren(
        ...tab.presets.map(([label, run]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn';
          button.dataset.variant = 'outline';
          button.dataset.size = 'xs';
          button.textContent = label;
          button.addEventListener('click', run);
          return button;
        }),
      );
      this.refresh();
    },
    setStore(status: StoreStatus, counts?: Record<string, number>) {
      store = status;
      if (counts) documents = counts;
      this.refresh();
    },
    isActive: (tab: Tab) => active === tab,
  };
}
export type Inspector = ReturnType<typeof createInspector>;
