# Collection.updateMany

```ts
updateMany(request: FindRequest, updater: Updater<T>, options?: WriteOptions & QueryOptions<T>): Promise<number>
```

Atomic bounded set update; return affected document count

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | yes |
| `updater` | `Updater<T>` | yes |
| `options` | `WriteOptions & QueryOptions<T>` | no |

## Returns

`Promise<number>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.updateMany({ filters: [{ field: 'status', op: 'eq', value: 'open' }] }, { status: 'paid' });
```

Interactive: [Collection.updateMany in the app](../../../app-api-docs.html#/ref/Collection/updateMany).
