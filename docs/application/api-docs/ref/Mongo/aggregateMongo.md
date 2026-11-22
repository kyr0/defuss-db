# aggregateMongo

```ts
aggregateMongo<T = Doc>(collection: MongoAggregatable, pipeline: readonly Doc[] | string): Promise<T[]>
```

MongoDB's result documents: { _id, ...accumulators }, or [{ [name]: n }] for $count (none when nothing matched).

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `collection` | `MongoAggregatable` | yes |
| `pipeline` | `readonly Doc[] \| string` | yes |

## Returns

`Promise<T[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';
import { aggregateMongo } from 'defuss-db/mongo';

const db = await openMemory();
const orders = db.collection('orders');
const result = await aggregateMongo(orders, [
  { $match: { status: 'paid' } },
  { $group: { _id: '$customer', revenue: { $sum: '$total' } } },
  { $sort: { revenue: -1 } },
]);
```

Interactive: [aggregateMongo in the app](../../../app-api-docs.html#/ref/Mongo/aggregateMongo).
