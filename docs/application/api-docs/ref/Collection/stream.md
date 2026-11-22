# Collection.stream

```ts
stream(request?: FindRequest, input?: QueryOptions<T>): AsyncGenerator<ComputeEvent<T>>
```

DataView batch / complete events

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |
| `input` | `QueryOptions<T>` | no |

## Returns

`AsyncGenerator<ComputeEvent<T>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
for await (const value of orders.stream({ filters: [{ field: 'customer', op: 'eq', value: 'grace' }] })) console.log(value);
```

Interactive: [Collection.stream in the app](../../../app-api-docs.html#/ref/Collection/stream).
