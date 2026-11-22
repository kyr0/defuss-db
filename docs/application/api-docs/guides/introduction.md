# Introduction

defuss-db is a document database that runs inside your application - in a browser worker, Node.js or Bun - with the same API in each.

Open a database, take a collection, then write and read. Each write commits in its own transaction unless you pass one, and a read sees one snapshot.

```ts
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
```

## How this reference works

The reference lists every documented function and method. Its signatures come from the type declarations the package ships, its descriptions from the [API guide](../../../guides/api.html). **Call it** runs a member on a sample database in this page - six orders with history, an ordered index and a search index - and the sample code beside the form follows your arguments. **Reset** starts the sample over.

Every page is also Markdown and JSON, linked under its title, and `api-docs/llms.txt` lists them all.

Interactive: [Introduction in the app](../../app-api-docs.html#/).
