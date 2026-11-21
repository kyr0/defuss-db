import { openOPFS } from 'defuss-db/browser'
// Run inside a dedicated worker on a secure origin.
interface Item { id: number; amount: bigint }
const db = await openOPFS({ namespace: 'shop' })
try {
  await db.collection<Item>('items').put({ id: 1, amount: 25n })
} finally { await db.close() }
