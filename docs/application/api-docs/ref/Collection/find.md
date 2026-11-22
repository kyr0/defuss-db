# Collection.find

```ts
find(request?: FindRequest, input?: QueryOptions<T>): Promise<T[]>
```

Document array

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<T[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.find({
  filters: [{ field: 'customer', op: 'eq', value: 'ada' }],
  sorters: [{ field: 'placedAt', direction: 'desc' }],
});
```

Interactive: [Collection.find in the app](../../../app-api-docs.html#/ref/Collection/find).
