import type { Row } from 'defuss-dbsonl';
import type { QueryCache } from './query-cache.js';
type Entry = { rows: Row<unknown>[]; bytes: number };
const stores = new WeakMap<QueryCache, Map<string, Entry>>();
/** Only immutable secondary-key postings are shared between snapshot leases. No document graph,
 * search input or transaction overlay enters this cache. A cache clear advances its owner epoch. */
export function postings(
  owner: QueryCache | undefined,
  key: string,
  rows?: Row<unknown>[],
): Row<unknown>[] | undefined {
  if (!owner) return;
  let map = stores.get(owner);
  if (!map) stores.set(owner, (map = new Map()));
  const hit = map.get(key);
  if (hit) {
    map.delete(key);
    map.set(key, hit);
    return hit.rows;
  }
  if (!rows) return;
  const budget = owner.options.maxTemporalIndexBytes;
  let bytes = 96 + key.length * 2;
  if (bytes > budget) return;
  for (const row of rows) {
    bytes += 96 + row.key.length * 2 + (row.value as string).length * 2;
    if (bytes > budget) return;
  }
  map.set(key, { rows, bytes });
  while (map.size > 8 || Array.from(map.values()).reduce((sum, e) => sum + e.bytes, 0) > budget)
    map.delete(map.keys().next().value!);
  return rows;
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
