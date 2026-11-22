import { openMemory } from 'defuss-db'
import { aggregateMongo, findMongo } from 'defuss-db/mongo'
type Order = { id: number; status: string; amount: number; items: { sku: string }[]; at: Date }
const db = await openMemory()
const orders = db.collection<Order>('orders')
await orders.createIndex({ name: 'byStatus', fields: ['status'] })
await orders.insertMany([
  { id: 1, status: 'paid', amount: 120, items: [{ sku: 'kb' }], at: new Date('2026-11-16') },
  { id: 2, status: 'paid', amount: 80, items: [{ sku: 'ms' }, { sku: 'kb' }], at: new Date('2026-11-18') },
  { id: 3, status: 'open', amount: 45, items: [{ sku: 'ms' }], at: new Date('2026-11-24') },
])
await findMongo(orders, "{ status: 'paid', 'items.sku': 'kb' }", { sort: { amount: -1 } })
// → ids 1, 2: status from the index; items.sku matches any item
await aggregateMongo(orders, [
  { $group: { _id: { $dateTrunc: { date: '$at', unit: 'week' } }, revenue: { $sum: '$amount' } } },
  { $sort: { _id: 1 } },
])
// → [{ _id: 2026-11-15, revenue: 200 }, { _id: 2026-11-22, revenue: 45 }]
