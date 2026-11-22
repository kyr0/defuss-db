# Collection.getMany

```ts
getMany(ids: readonly PrimaryKey[], options?: {
    signal?: AbortSignal;
} & HistoryReadOptions): Promise<(T | undefined)[]>
```

Ordered documents/undefined; duplicate IDs preserved; one snapshot; at most 100,000 IDs

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `ids` | `readonly PrimaryKey[]` | yes |
| `options` | `{         signal?: AbortSignal;     } & HistoryReadOptions` | no |

## Returns

`Promise<(T | undefined)[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.getMany(['o-1001', 'o-1003', 'o-9999']);
```

Interactive: [Collection.getMany in the app](../../../app-api-docs.html#/ref/Collection/getMany).
