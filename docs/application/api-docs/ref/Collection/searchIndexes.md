# Collection.searchIndexes

```ts
searchIndexes(options?: HistoryReadOptions): Promise<SearchIndexDefinition[]>
```

Persisted search definitions

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `HistoryReadOptions` | no |

## Returns

`Promise<SearchIndexDefinition[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.searchIndexes();
```

Interactive: [Collection.searchIndexes in the app](../../../app-api-docs.html#/ref/Collection/searchIndexes).
