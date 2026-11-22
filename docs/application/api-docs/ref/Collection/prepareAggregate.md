# Collection.prepareAggregate

```ts
prepareAggregate<const D extends AggregateDescriptor>(descriptor: D, cacheKey?: boolean): BoundQuery<T, AggregateOutput<D>>
```

Bound prepared plan: evaluate, stream, explain

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `descriptor` | `D` | yes |
| `cacheKey` | `boolean` | no |

## Returns

`BoundQuery<T, AggregateOutput<D>>`

## Call it

Returns a plan whose methods run later - the sample runs it.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const plan = orders.prepareAggregate({
  groupBy: { customer: q.field('customer') },
  measures: { revenue: q.sum(q.field('total')) },
});
const result = await plan.evaluate();
```

Interactive: [Collection.prepareAggregate in the app](../../../app-api-docs.html#/ref/Collection/prepareAggregate).
