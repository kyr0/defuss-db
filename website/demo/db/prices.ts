// The Price history tab's server side: a history-tracked price list read at an effective date and a recorded
// revision, each SKU's effective timeline and recorded changes, and retroactive corrections.
import type { Database } from 'defuss-db';
import { ts } from '../shared/code.js';
import type { Ops, TimelineRow } from '../shared/protocol.js';
import type { Price } from '../shared/records.js';
import { PRICE_CORRECTION, PRICE_LIST, PRICE_STEPS } from '../data.js';
import { plural, timed } from './trace.js';

type Result<K extends keyof Ops> = Promise<Ops[K]['result']>;
const day = (iso: string) => new Date(iso + 'T00:00:00Z');

export async function seedPrices(db: Database) {
  await db.ensureCollection<Price>('prices', { $trackHistory: true });
  // One transaction per price list: its writes share the effective date and one recorded revision.
  for (const [step, from] of PRICE_STEPS.entries())
    await db.transaction(
      async (tx) => {
        const prices = tx.collection<Price>('prices');
        for (const { id, product, eur } of PRICE_LIST)
          await prices.put({ id, product, eur: eur[step]! });
      },
      { $historic: day(from) },
    );
  // Recorded later, effective in the past: the mid-year prices of two SKUs were keyed wrong.
  await db.transaction(async (tx) => {
    const midYear = tx
      .collection<Price>('prices')
      .at(day(PRICE_CORRECTION.from), { $until: day(PRICE_CORRECTION.until) });
    for (const [id, eur] of Object.entries(PRICE_CORRECTION.eur)) await midYear.update(id, { eur });
  });
}

const segment = (
  row: { from: Date; until: Date | null; document: Price | undefined; revision: number },
  index: number,
): TimelineRow => ({
  id: String(index),
  from: row.from,
  until: row.until,
  eur: row.document?.eur ?? null,
  revision: row.revision,
});

export function pricesApi(db: () => Promise<Database>) {
  const prices = async () => (await db()).collection<Price>('prices');
  return {
    async 'prices.list'({ date, revision }: Ops['prices.list']['args']): Result<'prices.list'> {
      const collection = await prices();
      const effective = day(date);
      const options = revision === null ? {} : { $asOfRevision: revision };
      const request = { sorters: [{ field: 'id', direction: 'asc' as const }] };
      const [rows, ms] = await timed(() => collection.at(effective, options).find(request));
      return {
        rows,
        trace: {
          what: `prices.at().find(): ${plural(rows.length, 'price')} effective ${date}${
            revision === null ? '' : `, as recorded up to revision ${revision}`
          }`,
          ms,
          code: `const prices = await db.ensureCollection<Price>('prices', { $trackHistory: true });
// effective date: which price applied then; $asOfRevision: what the database knew at that commit
const rows = await prices.at(${ts(effective)}${revision === null ? '' : `, ${ts(options)}`}).find(${ts(request)});`,
        },
      };
    },

    /** Every recorded revision that changed a price, labelled by what it changed. */
    async 'prices.revisions'(): Result<'prices.revisions'> {
      const collection = await prices();
      const changes = new Map<number, { count: number; from: Date; until: Date | null }>();
      for (const { id } of PRICE_LIST)
        for (const change of await collection.audit(id)) {
          const known = changes.get(change.recorded.revision);
          if (known) known.count++;
          else
            changes.set(change.recorded.revision, {
              count: 1,
              from: change.from,
              until: change.until,
            });
        }
      const revisions = [...changes]
        .sort(([a], [b]) => a - b)
        .map(([revision, { count, from, until }]) => ({
          revision,
          label: `Revision ${revision}: ${plural(count, 'price')} from ${from.toISOString().slice(0, 10)}${
            until ? ` until ${until.toISOString().slice(0, 10)}` : ''
          }`,
        }));
      return { revisions, latest: (await (await db()).stats()).revision };
    },

    async 'prices.timeline'({ id }: Ops['prices.timeline']['args']): Result<'prices.timeline'> {
      const collection = await prices();
      const [[history, audit], ms] = await timed(() =>
        Promise.all([collection.history(id), collection.audit(id)]),
      );
      return {
        history: history.map(segment),
        audit: audit.map((change, index) => ({
          ...segment({ ...change, revision: change.recorded.revision }, index),
          kind: change.kind,
        })),
        trace: {
          what: `prices.history() and audit(): ${plural(history.length, 'segment')}, ${plural(audit.length, 'recorded change')} of ${id}`,
          ms,
          code: `// effective segments, newest start first: { from, until, document, revision }
const segments = await prices.history(${ts(id)});
// recorded changes, newest first: { kind, from, until, document, recorded: { storeId, revision } }
const changes = await prices.audit(${ts(id)});`,
        },
      };
    },

    async 'prices.correct'({
      id,
      eur,
      from,
      until,
    }: Ops['prices.correct']['args']): Result<'prices.correct'> {
      const store = await db();
      const collection = store.collection<Price>('prices');
      const options = { $historic: day(from), ...(until ? { $until: day(until) } : {}) };
      const before = (await store.stats()).revision;
      const [found, ms] = await timed(() => collection.update(id, { eur }, options));
      if (!found) throw new Error(`${id} had no price on ${from}.`);
      const revision = (await store.stats()).revision;
      return {
        revision,
        trace: {
          what: `prices.update(): ${id} is €${eur} from ${from}${until ? ` until ${until}` : ''}, recorded as revision ${revision}`,
          ms,
          code: `const before = (await db.stats()).revision; // ${before}: reads with this cutoff keep the old answer
await prices.update(${ts(id)}, { eur: ${ts(eur)} }, ${ts(options)});`,
        },
      };
    },
  };
}
