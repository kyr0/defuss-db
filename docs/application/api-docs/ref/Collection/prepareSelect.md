# Collection.prepareSelect

```ts
prepareSelect<const D extends RowsDescriptor>(descriptor: D, cacheKey?: boolean): BoundQuery<T, RowsOutput<D>>
```

Bound prepared plan: evaluate, stream, explain

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `descriptor` | `D` | yes |
| `cacheKey` | `boolean` | no |

## Returns

`BoundQuery<T, RowsOutput<D>>`

## Call it

Returns a plan whose methods run later - the sample runs it.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const plan = orders.prepareSelect({ select: { customer: q.field('customer'), total: q.field('total') } });
const result = await plan.evaluate({ limit: 10 });
```

Interactive: [Collection.prepareSelect in the app](../../../app-api-docs.html#/ref/Collection/prepareSelect).
