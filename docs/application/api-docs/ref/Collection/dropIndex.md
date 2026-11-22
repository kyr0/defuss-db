# Collection.dropIndex

```ts
dropIndex(indexName: string, options?: WriteOptions): Promise<boolean>
```

Atomic removal; return whether it existed

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `indexName` | `string` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<boolean>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.dropIndex('byCustomer');
```

Interactive: [Collection.dropIndex in the app](../../../app-api-docs.html#/ref/Collection/dropIndex).
