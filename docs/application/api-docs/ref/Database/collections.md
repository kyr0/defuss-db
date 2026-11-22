# Database.collections

```ts
collections(): Promise<string[]>
```

Persisted collection names, including now-empty collections

## Returns

`Promise<string[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.collections();
```

Interactive: [Database.collections in the app](../../../app-api-docs.html#/ref/Database/collections).
