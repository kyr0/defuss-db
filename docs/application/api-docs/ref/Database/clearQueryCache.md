# Database.clearQueryCache

```ts
clearQueryCache(): void
```

Clear results/history/plans and invalidate in-flight admissions

## Returns

`void`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = db.clearQueryCache();
```

Interactive: [Database.clearQueryCache in the app](../../../app-api-docs.html#/ref/Database/clearQueryCache).
