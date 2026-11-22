# Database.compact

```ts
compact(options?: Parameters<Dbsonl<unknown>['compact']>[0]): ReturnType<Dbsonl<unknown>['compact']>
```

Delegated DBSONL compaction; default optimistic, or { mode: 'exclusive' }

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `Parameters<Dbsonl<unknown>['compact']>[0]` | no |

## Returns

`ReturnType<Dbsonl<unknown>['compact']>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = db.compact();
```

Interactive: [Database.compact in the app](../../../app-api-docs.html#/ref/Database/compact).
