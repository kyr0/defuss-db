# Collection.has

```ts
has(id: PrimaryKey, options?: HistoryReadOptions): Promise<boolean>
```

Boolean

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `options` | `HistoryReadOptions` | no |

## Returns

`Promise<boolean>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.has('o-1002');
```

Interactive: [Collection.has in the app](../../../app-api-docs.html#/ref/Collection/has).
