// The API reference's runtime, bundled into docs/application/js/api-docs/client.js by scripts/api-docs.mjs: defuss-db
// from dist/ (the built package), the sample database, and call(), which runs a member on it and answers with what the
// page shows. In defuss-shadcn's scaffold the same module calls a defuss-rpc API; here the API is the library itself.
// Why the built package and not src/: the page then runs what npm users install. VERIFIED: scripts/e2e-site.mjs calls
// every member the page can run through this bundle.
import * as api from '../../dist/index.mjs';
import * as mongo from '../../dist/mongo.mjs';
import {
  ENTRIES,
  FIXED,
  NOT_HERE,
  exampleArgs as startingArgs,
  exampleValue,
  openSample,
  samples,
} from './sample.mjs';

export { exampleValue, samples };

let sample = openSample(api);

/** Opens the sample database again, as it started. */
export async function reset() {
  const { db } = await sample.catch(() => ({}));
  await db?.close().catch(() => {});
  sample = openSample(api);
  await sample;
}

/** A member's starting arguments, built with the expression builders and defuss-db/mongo. */
export const exampleArgs = (ns, m, doc) => startingArgs(ns, m, doc, { q: api.forRows(), mongo });

/** The arguments the page passes itself, by index, labelled as the sample code names them. */
export const fixed = (ns, m) => FIXED[ns + '.' + m] ?? {};

/** True when the page can run a member, else why not. */
export const callable = (ns, m) => NOT_HERE[ns + '.' + m] ?? true;

/** What a call runs on, for the form's status line. */
export function target(ns, m) {
  if (ns === 'Database')
    return 'Runs on db, the sample database in this page: collections orders and customers.';
  if (ns === 'Collection')
    return 'Runs on orders, the sample collection: six orders with history, the ordered index byCustomer and the search index notes.';
  if (ns === 'Mongo')
    return Object.keys(fixed(ns, m)).length
      ? 'Runs on orders, the sample collection, from defuss-db/mongo.'
      : 'Runs defuss-db/mongo in this page; it reads no collection.';
  const entry = Object.keys(ENTRIES).find((e) => ENTRIES[e].includes(m));
  return `Opens another database in this page's memory, from ${entry}.`;
}

// a value as the answer shows it: the library's objects (a Database, a Collection) by name, bytes by their count
const show = (value) => {
  if (value === null || typeof value !== 'object')
    return typeof value === 'function' ? '[function]' : value;
  if (value instanceof Date || value instanceof RegExp) return value;
  if (ArrayBuffer.isView(value)) return `${value.constructor.name}(${value.byteLength} bytes)`;
  if (Array.isArray(value)) return value.map(show);
  if (value instanceof Map) return new Map([...value].map(([k, v]) => [k, show(v)]));
  if (value instanceof Set) return new Set([...value].map(show));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    return value.constructor.name + (typeof value.name === 'string' ? ` '${value.name}'` : '');
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, show(v)]));
};
const message = (error) =>
  `${error?.name ?? 'Error'}${error?.code ? ' ' + error.code : ''}: ${error?.message ?? String(error)}`;

/**
 * Runs `ns.m(...args)` on the sample: `{ value }` (absent when the member returned undefined) or `{ error }`, the
 * values a stream yielded in `frames` (each also passed to `onFrame` as it arrives), and the time taken.
 */
export async function call(ns, m, args, onFrame = () => {}) {
  const started = performance.now();
  const ms = () => Math.round(performance.now() - started);
  const answer = (result) =>
    result === undefined ? { ms: ms() } : { value: show(result), ms: ms() };
  try {
    if (callable(ns, m) !== true) throw new Error(callable(ns, m));
    const { db, orders } = await sample;
    const filled = [...args];
    for (const [i, name] of Object.entries(fixed(ns, m)))
      filled[i] = name === 'orders.q' ? orders.q : orders;
    const self =
      ns === 'Database' ? db : ns === 'Collection' ? orders : ns === 'Mongo' ? mongo : api;
    const result = self[m](...filled);
    if (
      result &&
      typeof result[Symbol.asyncIterator] === 'function' &&
      typeof result.then !== 'function'
    ) {
      const frames = [];
      for await (const value of result) {
        frames.push(show(value));
        onFrame(show(value));
      }
      return { frames, ms: ms() };
    }
    return answer(await result);
  } catch (error) {
    return { error: message(error), ms: ms() };
  }
}
