# Collection.prepareView

```ts
prepareView<const D extends ViewDescriptor>(descriptor: D, cacheKey?: boolean): BoundQuery<T, RowsOutput<D>, TotalsOutput<D>>
```

Bound prepared plan: evaluate, stream, explain

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `descriptor` | `D` | yes |
| `cacheKey` | `boolean` | no |

## Returns

`BoundQuery<T, RowsOutput<D>, TotalsOutput<D>>`

## Call it

Returns a plan whose methods run later - the sample runs it.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const plan = orders.prepareView({
  select: { customer: q.field('customer'), total: q.field('total') },
  totals: { revenue: q.sum(q.field('total')) },
});
const result = await plan.evaluate({ limit: 10 });
```

Interactive: [Collection.prepareView in the app](../../../app-api-docs.html#/ref/Collection/prepareView).
