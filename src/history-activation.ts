import type { Dbsonl } from 'defuss-dbsonl';
import { clock, fence, seedAt, activationKey } from './history-store.js';
import { readSchema, schemaKey, documentPrefix, range } from './keys.js';
import { saveSchema } from './schema-cache.js';
import { versionKey } from './collection-version.js';
import type { Document, MutationLimits } from './types.js';

/** Baseline rows and the durable continuation advance together. A stopped process leaves a
 * resumable writer fence. Readers keep their live view until one schema commit publishes history. */
export async function activateBatches(
  store: Dbsonl<unknown>,
  c: string,
  limits: MutationLimits,
  batchHint?: number,
  signal?: AbortSignal,
) {
  let batch = Math.min(
    batchHint ?? 128,
    Math.max(1, Math.floor((limits.maxTransactionOperations - 3) / 6)),
  );
  let conflicts = 0;
  for (;;) {
    signal?.throwIfAborted();
    try {
      const step = await store.transaction(
        async (tx) => {
          const entry = await tx.get(schemaKey(c)),
            schema = readSchema(entry.value);
          if (schema.history) return true;
          if (!schema.activating) {
            await fence(tx);
            const { ms } = await clock(tx);
            // VERIFIED: tests/history.test.ts shows that without DDL a collection with documents has no stored schema; its r:
            // marker shows it exists, so its documents are seeded.
            if (!entry.found && !(await tx.get(versionKey(c))).found) {
              const configured = { ...schema, history: { coverageFrom: null } };
              tx.put(activationKey(c), null);
              await saveSchema(tx, c, configured);
              return true;
            }
            await saveSchema(tx, c, { ...schema, activating: { from: ms, after: '' } }, false);
            return false;
          }
          const { from, after } = schema.activating,
            prefix = documentPrefix(c);
          let last = after,
            rows = 0;
          for await (const row of tx.scan({
            gte: after ? after + '\0' : prefix,
            lt: range(prefix).lt,
            limit: batch,
            signal,
          })) {
            await seedAt(tx, c, row.value as Document, from);
            last = row.key;
            rows++;
          }
          if (rows === batch) {
            await saveSchema(tx, c, { ...schema, activating: { from, after: last } }, false);
            return false;
          }
          const { activating: _pending, ...published } = schema;
          tx.put(activationKey(c), from);
          await saveSchema(tx, c, { ...published, history: { coverageFrom: from } });
          return true;
        },
        { signal },
      );
      if (step.result) return;
      conflicts = 0;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'CONFLICT' && ++conflicts <= 12) continue;
      if (code === 'LIMIT_EXCEEDED' && batch > 1) {
        batch = Math.max(1, Math.floor(batch / 2));
        continue;
      }
      throw error;
    }
  }
}
