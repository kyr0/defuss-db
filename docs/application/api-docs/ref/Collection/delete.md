# Collection.delete

```ts
delete(id: PrimaryKey, options?: WriteOptions): Promise<boolean>
```

Return whether ID existed

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<boolean>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.delete('o-1005');
```

Interactive: [Collection.delete in the app](../../../app-api-docs.html#/ref/Collection/delete).
