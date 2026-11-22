# Collection.deleteMany

```ts
deleteMany(request?: FindRequest, options?: WriteOptions & QueryOptions<T>): Promise<number>
```

Atomic bounded set deletion; return affected document count

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |
| `options` | `WriteOptions & QueryOptions<T>` | no |

## Returns

`Promise<number>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.deleteMany({ filters: [{ field: 'customer', op: 'eq', value: 'grace' }] });
```

Interactive: [Collection.deleteMany in the app](../../../app-api-docs.html#/ref/Collection/deleteMany).
