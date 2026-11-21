// Data Grid helpers shared by the tabs: building a grid for a column list, reading the record under a click, and
// following a grid's selection.
import type { Column } from '../shared/reports.js';
import { shadcn, type Row } from './shadcn.js';

/** A new, empty .data-grid element with one header per column; defuss-shadcn initializes it once it is attached. */
export function newGrid(columns: readonly Column[], label: string, emptyText: string): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'data-grid';
  grid.setAttribute('aria-label', label);
  grid.dataset.persist = 'none';
  grid.dataset.select = 'single';
  grid.dataset.emptyText = emptyText;
  const viewport = document.createElement('div');
  viewport.className = 'data-grid-viewport';
  const head = document.createElement('div');
  head.className = 'data-grid-head';
  const row = document.createElement('div');
  row.className = 'data-grid-row';
  for (const [field, title, width, format] of columns) {
    const header = document.createElement('div');
    header.className = 'data-grid-header';
    header.dataset.field = field;
    header.dataset.width = width;
    const numeric = format !== undefined && format !== '' && format !== 'date';
    if (numeric) header.dataset.type = 'number';
    if (format !== undefined) header.dataset.format = format;
    header.dataset.filter = numeric ? 'number' : format === 'date' ? '' : 'text';
    if (!header.dataset.filter) delete header.dataset.filter;
    header.textContent = title;
    row.append(header);
  }
  const body = document.createElement('div');
  body.className = 'data-grid-body';
  head.append(row);
  viewport.append(head, body);
  grid.append(viewport);
  return grid;
}

/** The record of the row under a click. Rows are recycled elements: read it through rows()[data-index]. */
export function clickedRecord(grid: HTMLElement, event: Event): Row | undefined {
  const row = (event.target as Element).closest<HTMLElement>('.data-grid-body .data-grid-row');
  const index = row?.dataset.index;
  return index === undefined ? undefined : shadcn().dataGrid.rows(grid)[Number(index)];
}

/** Calls `pick` with the record of every clicked row and every row activated with Enter. */
export function onRecord(grid: HTMLElement, pick: (record: Row) => void) {
  // capture: the grid handles Shift and Ctrl clicks (range and toggle selection) without letting them bubble
  grid.addEventListener(
    'click',
    (event) => {
      const record = clickedRecord(grid, event);
      if (record) pick(record);
    },
    { capture: true },
  );
  grid.addEventListener('data-grid-activate', (event) =>
    pick((event as CustomEvent<{ record: Row }>).detail.record),
  );
}

export const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
