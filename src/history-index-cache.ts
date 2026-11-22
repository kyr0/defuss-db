import type { Row } from 'defuss-dbsonl';
import type { QueryCache } from './query-cache.js';
/**
 * A secondary index materialized over the versions one historical view sees. `complete` is false when it left out a
 * version a query could match: indexes check the versions they are built on, and an older version may hold an
 * object, array, Map, Set or oversized value in a field indexed later (see build in history-view.ts).
 * VERIFIED: tests/history.test.ts 'cannot key' and 'key limit' compare such views with scans.
 */
export type Postings = { rows: Row<unknown>[]; complete: boolean };
type Entry = Postings & { bytes: number };
const stores = new WeakMap<QueryCache, Map<string, Entry>>();
/** Only immutable secondary-key postings are shared between snapshot leases. No document graph,
 * search input or transaction overlay enters this cache. A cache clear advances its owner epoch. */
export function postings(
  owner: QueryCache | undefined,
  key: string,
  value?: Postings,
): Postings | undefined {
  if (!owner) return;
  let map = stores.get(owner);
  if (!map) stores.set(owner, (map = new Map()));
  const hit = map.get(key);
  if (hit) {
    map.delete(key);
    map.set(key, hit);
    return hit;
  }
  if (!value) return;
  const budget = owner.options.maxTemporalIndexBytes;
  let bytes = 96 + key.length * 2;
  if (bytes > budget) return;
  for (const row of value.rows) {
    bytes += 96 + row.key.length * 2 + (row.value as string).length * 2;
    if (bytes > budget) return;
  }
  map.set(key, { ...value, bytes });
  while (map.size > 8 || Array.from(map.values()).reduce((sum, e) => sum + e.bytes, 0) > budget)
    map.delete(map.keys().next().value!);
  return value;
}
export function clearPostings(owner: QueryCache) {
  stores.delete(owner);
}
export function projectionStats(owner: QueryCache) {
  const m = stores.get(owner);
  return {
    temporalIndexes: m?.size ?? 0,
    temporalIndexBytes: m ? Array.from(m.values()).reduce((sum, e) => sum + e.bytes, 0) : 0,
  };
}
