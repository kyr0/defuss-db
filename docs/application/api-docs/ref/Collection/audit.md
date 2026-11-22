# Collection.audit

```ts
audit(id: PrimaryKey, options?: HistoryListOptions): Promise<HistoryChange<T>[]>
```

Recorded changes, newest first: kind, the asserted interval and recorded: { storeId, revision }

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `options` | `HistoryListOptions` | no |

## Returns

`Promise<HistoryChange<T>[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.audit('o-1001');
```

Interactive: [Collection.audit in the app](../../../app-api-docs.html#/ref/Collection/audit).
