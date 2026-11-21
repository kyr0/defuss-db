// The parts of defuss-shadcn 0.9.14's runtime (vendor/all.min.js, loaded before app.js) this page calls, typed from
// its component skills. The page reaches components only through df$.shadcn.*, el.api, el.store and their events.

export type Row = Record<string, unknown>;

export interface ComponentElement<C = Row> extends HTMLElement {
  api: {
    setState(name: string, config?: Partial<C>): unknown;
    getState(): { name: string; config: C };
  };
  store: {
    value: { name: string; config: C };
    subscribe(listener: (state: { name: string; config: C }) => void): () => void;
  };
}

export interface GridConfig {
  filters: { field: string; op: string; value: unknown }[];
  sorters: { field: string; direction?: 'asc' | 'desc' }[];
  locked: string[];
  page: number;
  selected: unknown[];
}

interface Shadcn {
  dataGrid: {
    setSource(
      el: HTMLElement,
      rows: Row[],
      options?: {
        cells?: Record<string, (el: HTMLElement, record: Row) => void>;
        load?: (offset: number, size: number) => Promise<Row[]>;
        query?: Partial<GridConfig>;
        persist?: { area: 'session' | 'local' | 'none' };
      },
    ): void;
    query(el: HTMLElement, patch: Partial<GridConfig>): void;
    rows(el: HTMLElement): Row[];
    selected(el: HTMLElement): Row[];
  };
  autocomplete: {
    configure(
      el: HTMLElement,
      config: {
        label?: (record: Row) => string;
        load?: (
          request: { query: string; page: number; pageSize: number },
          options: { signal: AbortSignal },
        ) => Promise<{ rows: Row[]; total: number }>;
        render?: (
          option: HTMLElement,
          record: Row,
          context: { query: string; index: number },
        ) => void;
      },
    ): void;
    search(el: HTMLElement, query: string): Promise<void>;
    records(el: HTMLElement): Row[];
  };
  propertyGrid: { configure(el: HTMLElement, config: { source: Row }): void };
}

declare global {
  var df$: { shadcn: Shadcn };
}

export const shadcn = (): Shadcn => globalThis.df$.shadcn;

/** The element with this id, typed as a component element; a missing id is a broken page and throws. */
export function component<C = Row>(id: string): ComponentElement<C> {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html.`);
  return el as ComponentElement<C>;
}

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html.`);
  return el as T;
}
