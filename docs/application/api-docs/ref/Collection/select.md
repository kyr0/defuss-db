# Collection.select

```ts
select<const D extends RowsDescriptor>(descriptor: D, page?: Page, input?: QueryOptions<T>): Promise<ComputeResult<RowsOutput<D>>>
```

Typed projected rows and summary

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `descriptor` | `D` | yes |
| `page` | `Page` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<ComputeResult<RowsOutput<D>>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const result = await orders.select({
  select: { customer: q.field('customer'), total: q.field('total') },
  filters: [{ field: 'status', op: 'eq', value: 'open' }],
});
```

Interactive: [Collection.select in the app](../../../app-api-docs.html#/ref/Collection/select).
