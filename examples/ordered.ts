import { openMemory, type Document } from 'defuss-db';

interface Event extends Document {
  tenant: string;
  at: Date;
}
const db = await openMemory();
try {
  const events = db.collection<Event>('events');
  await events.createIndex({ name: 'feed', fields: ['tenant', 'at'], order: ['asc', 'desc'] });
  await events.insertMany([
    { id: 'a', tenant: 'eu', at: new Date(10) },
    { id: 'b', tenant: 'eu', at: new Date(20) },
    { id: 'c', tenant: 'eu', at: new Date(20) },
    { id: 'd', tenant: 'us', at: new Date(30) },
  ]);
  const snapshot = await db.snapshot();
  try {
    const stable = snapshot.collection<Event>('events');
    let after: string | undefined;
    do {
      const page = await stable.pageByIndex('feed', { prefix: ['eu'], limit: 2, after });
      console.log(page.rows.map((row) => row.id));
      after = page.nextCursor ?? undefined;
    } while (after);
  } finally {
    await snapshot.close();
  }
} finally {
  await db.close();
}
