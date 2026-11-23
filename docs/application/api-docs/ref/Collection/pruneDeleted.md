# Collection.pruneDeleted

```ts
pruneDeleted(options?: PruneOptions): Promise<PruneResult>
```

Tracked collections: remove the documents deleted before before with every version; return { documents, versions }

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `PruneOptions` | no |

## Returns

`Promise<PruneResult>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.pruneDeleted();
```

Interactive: [Collection.pruneDeleted in the app](../../../app-api-docs.html#/ref/Collection/pruneDeleted).
