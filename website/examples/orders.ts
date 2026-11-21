import { openOPFS } from 'defuss-db/browser' // in a worker
// Node.js, Bun: openDirectory() from 'defuss-db/server'
interface Order {
  id: string; customer: string
  total: bigint; placedAt: Date
}
interface Stock { id: string; reserved: number }
const db = await openOPFS({ namespace: 'shop' })
const orders = db.collection<Order>('orders')
await orders.createIndex({
  name: 'byCustomer',
  fields: ['customer', 'placedAt'],
  order: ['asc', 'desc'],
})
await db.transaction(async (tx) => {
  await tx.collection<Order>('orders').insert({
    customer: 'ada', total: 120n, placedAt: new Date(),
  })
  await tx.collection<Stock>('stock')
    .put({ id: 'sku-7', reserved: 1 })
})
const page = await orders.pageByIndex('byCustomer', {
  prefix: ['ada'], limit: 20,
})
await db.close()
