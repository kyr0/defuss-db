import { openDirectory } from 'defuss-db/server';
import type { Document } from 'defuss-db';
interface Order extends Document {
  country: string;
  amount: number;
  date: Date;
}
const db = await openDirectory('./output/example-db', { name: 'orders' });
try {
  const orders = db.collection<Order>('orders');
  await orders.createIndex({ name: 'country', fields: ['country'] });
  await orders.put({ id: 'a', country: 'DE', amount: 12.5, date: new Date() });
  await orders.put({ id: 'b', country: 'AT', amount: 25, date: new Date() });
  const q = orders.q;
  console.log(
    await orders.aggregate({
      groupBy: { country: q.field('country') },
      measures: { total: q.sum(q.field('amount')), n: q.count() },
    }),
  );
  for await (const event of orders.stream()) if (event.type === 'batch') console.log(event.rows);
  console.log(await db.verify());
} finally {
  await db.close();
}
