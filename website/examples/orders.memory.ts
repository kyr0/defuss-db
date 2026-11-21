import { openMemory } from 'defuss-db'
interface Order {
  id: string; customer: string
  total: bigint; placedAt: Date
}
interface Stock { id: string; reserved: number }
const db = await openMemory()
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
