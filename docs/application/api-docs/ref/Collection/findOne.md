# Collection.findOne

```ts
findOne(request?: FindRequest, input?: QueryOptions<T>): Promise<T | undefined>
```

First matching document or undefined; effective limit is one

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<T | undefined>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.findOne({ filters: [{ field: 'status', op: 'eq', value: 'open' }] });
```

Interactive: [Collection.findOne in the app](../../../app-api-docs.html#/ref/Collection/findOne).
