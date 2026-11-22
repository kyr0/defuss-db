# Collection.indexes

```ts
indexes(options?: HistoryReadOptions): Promise<IndexDefinition[]>
```

Fresh persisted equality and ordered definitions

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `HistoryReadOptions` | no |

## Returns

`Promise<IndexDefinition[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.indexes();
```

Interactive: [Collection.indexes in the app](../../../app-api-docs.html#/ref/Collection/indexes).
