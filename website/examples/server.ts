import { openDirectory } from 'defuss-db/server'
interface Item { id: string; time: Date }
const db = await openDirectory('./data', { name: 'shop' })
try {
  const items = db.collection<Item>('items')
  await items.put({ id: 'one', time: new Date() })
  console.log(await items.get('one'))
} finally { await db.close() }
