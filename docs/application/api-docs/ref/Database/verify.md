# Database.verify

```ts
verify(): Promise<{
    revision: number;
    documents: number;
    indexEntries: number;
    collections: number;
}>
```

{ revision, documents, indexEntries, collections } after physical and logical audit

## Returns

`Promise<{
        revision: number;
        documents: number;
        indexEntries: number;
        collections: number;
    }>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.verify();
```

Interactive: [Database.verify in the app](../../../app-api-docs.html#/ref/Database/verify).
