# Collection.aggregate

```ts
aggregate<const D extends AggregateDescriptor>(descriptor: D, page?: Page, input?: QueryOptions<T>): Promise<ComputeResult<AggregateOutput<D>>>
```

Typed grouped/scalar rows and summary

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `descriptor` | `D` | yes |
| `page` | `Page` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<ComputeResult<AggregateOutput<D>>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const result = await orders.aggregate({
  groupBy: { customer: q.field('customer') },
  measures: { orders: q.count(), revenue: q.sum(q.field('total')) },
});
```

Interactive: [Collection.aggregate in the app](../../../app-api-docs.html#/ref/Collection/aggregate).
