# Collection.history

```ts
history(id: PrimaryKey, options?: HistoryListOptions): Promise<HistorySegment<T>[]>
```

Effective segments, newest start first: from, exclusive until (null while open), document (undefined for a delete), revision, ordinal

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `options` | `HistoryListOptions` | no |

## Returns

`Promise<HistorySegment<T>[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.history('o-1001');
```

Interactive: [Collection.history in the app](../../../app-api-docs.html#/ref/Collection/history).
