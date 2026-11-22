# Collection.createIndex

```ts
createIndex(index: IndexDefinition, options?: WriteOptions): Promise<void>
```

Atomic equality or ordered build. Set order to one direction per field. An identical declaration is idempotent; mismatched existing name rejects

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `index` | `IndexDefinition` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<void>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.createIndex({ name: 'byStatus', fields: ['status'] });
```

Interactive: [Collection.createIndex in the app](../../../app-api-docs.html#/ref/Collection/createIndex).
