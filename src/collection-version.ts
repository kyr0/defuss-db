import { DatabaseError } from './errors.js';
import type { Reader, Writer } from './types.js';

export const versionKey = (collection: string) => 'r:' + collection;
const touched = new WeakMap<Writer, Set<string>>();

/** Blind-write once per changed collection. DBSONL assigns the actual commit revision to the record.
 * Reading the marker before writing it would make otherwise disjoint document updates conflict.
 */
export function touchCollection(tx: Writer, collection: string): void {
  let names = touched.get(tx);
  if (!names) touched.set(tx, (names = new Set()));
  if (names.has(collection)) return;
  tx.put(versionKey(collection), 1);
  names.add(collection);
}
export async function collectionVersion(reader: Reader, collection: string): Promise<number> {
  const mark = await reader.get(versionKey(collection));
  if (mark.found && mark.value !== 1)
    throw new DatabaseError('CORRUPT', 'Invalid collection revision marker.');
  // A collection that no commit has touched yet has the stable version zero.
  return mark.revision ?? 0;
}
