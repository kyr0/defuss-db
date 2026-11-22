# Collection.query

```ts
query(request?: FindRequest, input?: QueryOptions<T>): Promise<ComputeResult<T>>
```

{ rows, summary }

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`Promise<ComputeResult<T>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.query({ filters: [{ field: 'total', op: 'gte', value: 50 }], limit: 2 });
```

Interactive: [Collection.query in the app](../../../app-api-docs.html#/ref/Collection/query).
