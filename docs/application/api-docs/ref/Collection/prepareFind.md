# Collection.prepareFind

```ts
prepareFind(request?: FindRequest, cacheKey?: boolean): BoundQuery<T, T>
```

Bound prepared plan: evaluate, stream, explain

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |
| `cacheKey` | `boolean` | no |

## Returns

`BoundQuery<T, T>`

## Call it

Returns a plan whose methods run later - the sample runs it.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const plan = orders.prepareFind({ filters: [{ field: 'customer', op: 'eq', value: 'ada' }] });
const result = await plan.evaluate();
console.log(plan.explain());
```

Interactive: [Collection.prepareFind in the app](../../../app-api-docs.html#/ref/Collection/prepareFind).
