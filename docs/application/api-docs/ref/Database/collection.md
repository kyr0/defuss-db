# Database.collection

```ts
collection<T extends CollectionEntry = CollectionEntry>(collection: typeof COLLECTIONS): ReadCollection<T>
collection<T extends Document = Document>(collection: string): Collection<T>
```

Typed live collection; no I/O merely to obtain it. collection('_collections') is the read-only catalog, see Schemas and validation

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `collection` | `typeof COLLECTIONS` | yes |

## Returns

`ReadCollection<T>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = db.collection('orders');
```

Interactive: [Database.collection in the app](../../../app-api-docs.html#/ref/Database/collection).
