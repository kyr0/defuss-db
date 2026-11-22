# Collection.get

```ts
get(id: PrimaryKey, options?: HistoryReadOptions): Promise<T | undefined>
```

Document or undefined

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `options` | `HistoryReadOptions` | no |

## Returns

`Promise<T | undefined>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.get('o-1001');
```

Interactive: [Collection.get in the app](../../../app-api-docs.html#/ref/Collection/get).
