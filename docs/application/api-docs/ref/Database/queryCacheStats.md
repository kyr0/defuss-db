# Database.queryCacheStats

```ts
queryCacheStats(): QueryCacheStats | undefined
```

Result/plan/pending counters and accounted bytes, or undefined when disabled

## Returns

`QueryCacheStats | undefined`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = db.queryCacheStats();
```

Interactive: [Database.queryCacheStats in the app](../../../app-api-docs.html#/ref/Database/queryCacheStats).
