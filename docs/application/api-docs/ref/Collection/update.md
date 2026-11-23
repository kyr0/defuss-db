# Collection.update

```ts
update(id: PrimaryKey, updater: Updater<T>, options?: DocumentWriteOptions): Promise<boolean>
```

Shallow own-property patch or complete replacement callback; return whether ID existed

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `updater` | `Updater<T>` | yes |
| `options` | `DocumentWriteOptions` | no |

## Returns

`Promise<boolean>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.update('o-1002', { status: 'paid' });
```

Interactive: [Collection.update in the app](../../../app-api-docs.html#/ref/Collection/update).
