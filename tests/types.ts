import type { Collection, Document, NewDocument } from '../src/index.js';
interface Row extends Document {
  label: string;
  amount: number;
}
export async function check(collection: Collection<Row>) {
  const input: NewDocument<Row> = { label: 'A', amount: 1 };
  void input;
  const q = collection.q;
  const result = await collection.view({
    select: { title: q.field('label') },
    totals: { amount: q.sum(q.field('amount')) },
  });
  const title: string = result.rows[0]!.title,
    amount: number | null = result.totals.amount;
  void title;
  void amount;
  // @ts-expect-error field is not declared on Row
  q.field('absent');
  // @ts-expect-error aliases replace input fields
  void result.rows[0]!.label;
}

// Numeric-only IDs cannot be generated as UUID strings.
// @ts-expect-error numeric ID is required
const numeric: NewDocument<{ id: number; x: number }> = { x: 1 };
void numeric;
