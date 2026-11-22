# Collection.q

```ts
q: defuss_dataview_compute.ComputeFor<T>
```

DataView forRows<T>() builders and plan factories

## Returns

`defuss_dataview_compute.ComputeFor<T>`

## Call it

A property: the builders of the expressions that descriptors hold.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const q = orders.q;
const result = await orders.aggregate({
  groupBy: { customer: q.field('customer') },
  measures: { revenue: q.sum(q.field('total')) },
});
```

Interactive: [Collection.q in the app](../../../app-api-docs.html#/ref/Collection/q).
