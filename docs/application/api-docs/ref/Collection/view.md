# Collection.view

```ts
view<const D extends ViewDescriptor>(descriptor: D, page?: Page, input?: QueryOptions<T>): Promise<ViewResult<RowsOutput<D>, TotalsOutput<D>>>
```

Typed projected rows, totals and summary

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `descriptor` | `D` | yes |
| `page` | `Page` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<ViewResult<RowsOutput<D>, TotalsOutput<D>>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const result = await orders.view({
  select: { customer: q.field('customer'), total: q.field('total') },
  totals: { revenue: q.sum(q.field('total')) },
});
```

Interactive: [Collection.view in the app](../../../app-api-docs.html#/ref/Collection/view).
