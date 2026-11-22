# Collection.dropSearchIndex

```ts
dropSearchIndex(indexName: string, options?: WriteOptions): Promise<boolean>
```

Atomic removal of search inputs, state and definition

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
const result = await orders.dropSearchIndex('notes');
```

Interactive: [Collection.dropSearchIndex in the app](../../../app-api-docs.html#/ref/Collection/dropSearchIndex).
