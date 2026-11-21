// Bundle this entry as an ES module Worker, for example with Vite or esbuild.
import { openOPFS } from 'defuss-db/browser';
import type { Document } from 'defuss-db';
interface Counter extends Document {
  n: number;
  modified: Date;
}
const database = openOPFS({ namespace: 'defuss-db-example', name: 'counter' });
self.onmessage = async () => {
  try {
    const db = await database;
    const receipt = await db.transaction(async (tx) => {
      const counters = tx.collection<Counter>('counters');
      const previous = await counters.get('main');
      const next = { id: 'main', n: (previous?.n ?? 0) + 1, modified: new Date() };
      await counters.put(next);
      return next;
    });
    self.postMessage({ ok: true, value: receipt.result, revision: receipt.revision });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
