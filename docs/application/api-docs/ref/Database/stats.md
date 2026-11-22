# Database.stats

```ts
stats(): Promise<{
    parallel?: ParallelStats | undefined;
    storedEntries: number;
    autoCompaction: AutoCompactStats;
    generation: string;
    committedBytes: number;
    cacheBytes: number;
    cachePages: number;
    durability: Backend["durability"];
    revision: number;
}>
```

DBSONL metadata; storedEntries includes documents, schemas, indexes and marker; autoCompaction holds state, runs, conflicts, failures and reclaimedBytes; on directory stores, parallel holds state (idle, starting, ready, failed, closed), workers, minRows, queries, fallbacks, starts and, after a failed start, error

## Returns

`Promise<{
        parallel?: ParallelStats | undefined;
        storedEntries: number;
        autoCompaction: AutoCompactStats;
        generation: string;
        committedBytes: number;
        cacheBytes: number;
        cachePages: number;
        durability: Backend["durability"];
        revision: number;
    }>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.stats();
```

Interactive: [Database.stats in the app](../../../app-api-docs.html#/ref/Database/stats).
