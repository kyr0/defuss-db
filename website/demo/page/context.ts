// What every tab receives from the page: the worker client, the inspector, the store's document counts, and a way
// to report that it wrote, so the store figures follow.
import type { Trace } from '../shared/protocol.js';
import { message, type Client } from './client.js';
import type { Inspector, Tab } from './inspector.js';

export interface Context {
  client: Client;
  inspector: Inspector;
  counts(): Record<string, number> | null;
  /** A tab committed a write: refresh the revision, entries and bytes shown for the store. */
  wrote(): void;
}

/** Awaits a worker call, records its trace or error on the tab and refreshes the inspector; null when it failed. */
export async function traced<T extends { trace: Trace }>(
  tab: Tab,
  inspector: Inspector,
  call: Promise<T>,
): Promise<T | null> {
  try {
    const value = await call;
    tab.trace = value.trace;
    tab.error = null;
    return value;
  } catch (error) {
    tab.error = message(error);
    return null;
  } finally {
    inspector.refresh();
  }
}
