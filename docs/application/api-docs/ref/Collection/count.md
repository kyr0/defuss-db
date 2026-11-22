# Collection.count

```ts
count(selection?: Selection, input?: QueryOptions<T>): Promise<number>
```

Exact count of matching documents

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `selection` | `Selection` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<number>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.count({ filters: [{ field: 'status', op: 'eq', value: 'paid' }] });
```

Interactive: [Collection.count in the app](../../../app-api-docs.html#/ref/Collection/count).
