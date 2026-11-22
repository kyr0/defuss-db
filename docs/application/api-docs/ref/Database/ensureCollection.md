# Database.ensureCollection

```ts
ensureCollection<T extends Document = Document>(collection: string, options?: CollectionOptions): Promise<Collection<T>>
```

Persist $trackHistory and $timestamps, then return the collection; idempotent, and both settings are permanent

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `collection` | `string` | yes |
| `options` | `CollectionOptions` | no |

## Returns

`Promise<Collection<T>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.ensureCollection('refunds', { $timestamps: true });
```

Interactive: [Database.ensureCollection in the app](../../../app-api-docs.html#/ref/Database/ensureCollection).
