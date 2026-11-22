# Database.collect

```ts
collect(): ReturnType<Dbsonl<unknown>['collect']>
```

Delegated reclamation of unpinned generations

## Returns

`ReturnType<Dbsonl<unknown>['collect']>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = db.collect();
```

Interactive: [Database.collect in the app](../../../app-api-docs.html#/ref/Database/collect).
