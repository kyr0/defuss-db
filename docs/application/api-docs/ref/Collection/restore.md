# Collection.restore

```ts
restore(id: PrimaryKey, options?: Omit<WriteOptions, '$historic' | '$until' | '$asOfRevision'>): Promise<boolean>
```

Tracked collections: write back the version a delete removed as a new version; return false if the document is live or was never deleted

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |
| `options` | `Omit<WriteOptions, '$historic' \| '$until' \| '$asOfRevision'>` | no |

## Returns

`Promise<boolean>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.restore('o-1005');
```

Interactive: [Collection.restore in the app](../../../app-api-docs.html#/ref/Collection/restore).
