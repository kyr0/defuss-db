# Database.snapshot

```ts
snapshot(): Promise<DatabaseSnapshot>
```

Read-only DatabaseSnapshot, with revision, collection<T>, close

## Returns

`Promise<DatabaseSnapshot>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.snapshot();
```

Interactive: [Database.snapshot in the app](../../../app-api-docs.html#/ref/Database/snapshot).
