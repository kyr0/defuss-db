// Search tab: an Autocomplete whose loader sends each keystroke's request to the worker, which answers it with
// collection.search() over a persisted lexical index. Typing again aborts the request in flight in the component;
// the worker's answer to an aborted request is dropped.
import { CATEGORY_NAMES } from '../data.js';
import type { Ops } from '../shared/protocol.js';
import { message } from './client.js';
import type { Context } from './context.js';
import type { Tab } from './inspector.js';
import { component, element, shadcn, type Row } from './shadcn.js';

const price = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

export function searchTab({ client, inspector, counts }: Context): Tab {
  const box = component('item');
  const category = element<HTMLSelectElement>('search-category');
  const stock = element<HTMLInputElement>('search-stock');
  let last: Ops['catalog.search']['result'] | null = null;

  const tab: Tab = {
    component: 'Autocomplete',
    api: 'df$.shadcn.autocomplete · configure(el, { load })',
    recordHint: 'Pick an item.',
    note: 'BM25 over name, brand and description, with English stemming. Every word must match; the last one may be a prefix, and each may be one edit from an indexed, stemmed word. Category and stock filters restrict which documents can rank, before the top hits are taken.',
    trace: null,
    error: null,
    record: null,
    presets: [
      ['“wireless keyboard”', () => void search('wireless keyboard')],
      ['“thunderbolt dock”', () => void search('thunderbolt dock')],
      ['“noise canceling”', () => void search('noise canceling')],
      ['“wirless mouse” (typo)', () => void search('wirless mouse')],
    ],
    stats: () => [
      ['Items', counts()?.catalog ?? '…'],
      ['Matches', last?.total ?? 0],
      ['Listed', shadcn().autocomplete.records(box).length],
    ],
    async load() {
      for (const name of CATEGORY_NAMES) category.append(new Option(name, name));
      shadcn().autocomplete.configure(box, {
        label: (record) => String(record.name),
        render(option, record) {
          const name = document.createElement('span');
          name.className = 'dv-option-name';
          name.textContent = String(record.name);
          const detail = document.createElement('span');
          detail.className = 'dv-option-detail';
          detail.textContent = `${String(record.category)} · ${price.format(Number(record.price))}${record.inStock ? '' : ' · out of stock'}`;
          option.replaceChildren(name, detail);
        },
        load: async (request, { signal }) => {
          try {
            const result = await client.call('catalog.search', {
              query: request.query,
              page: request.page,
              pageSize: request.pageSize,
              category: category.value,
              inStock: stock.checked,
            });
            if (signal.aborted) throw signal.reason;
            last = result;
            tab.trace = result.trace;
            tab.error = null;
            return { rows: result.rows as unknown as Row[], total: result.total };
          } catch (error) {
            if (!signal.aborted) tab.error = message(error);
            throw error;
          } finally {
            inspector.refresh();
          }
        },
      });
      box.addEventListener('autocomplete-select', (event) => {
        tab.record = (event as CustomEvent<{ record: Row }>).detail.record;
        inspector.refresh();
      });
    },
  };

  const search = (query: string) => shadcn().autocomplete.search(box, query);
  const again = () => {
    const query = element<HTMLInputElement>('item-input').value;
    if (query) void search(query);
  };
  category.addEventListener('change', again);
  stock.addEventListener('change', again);
  return tab;
}
