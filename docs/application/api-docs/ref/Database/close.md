# Database.close

```ts
close(): Promise<void>
```

Idempotent close; database and snapshots support Symbol.asyncDispose

## Returns

`Promise<void>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.close();
```

Interactive: [Database.close in the app](../../../app-api-docs.html#/ref/Database/close).
