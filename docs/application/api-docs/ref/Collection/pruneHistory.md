# Collection.pruneHistory

```ts
pruneHistory(options?: PruneHistoryOptions): Promise<PruneResult>
```

Tracked collections: remove the versions that ended at or before before, of the whole collection or of ids; return { documents, versions }. See Pruning

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `PruneHistoryOptions` | no |

## Returns

`Promise<PruneResult>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.pruneHistory();
```

Interactive: [Collection.pruneHistory in the app](../../../app-api-docs.html#/ref/Collection/pruneHistory).
