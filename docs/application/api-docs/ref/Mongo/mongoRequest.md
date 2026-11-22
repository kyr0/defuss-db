# mongoRequest

```ts
mongoRequest(q: unknown, filter?: MongoDocument, sort?: MongoDocument, options?: TranslateOptions): MongoRequest
```

{ filters, where?, sorters? } for find, query, count or explain. scalarFields names the top-level fields an index covers; scalarOptions(collection) reads them.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `q` | `unknown` | yes |
| `filter` | `MongoDocument` | no |
| `sort` | `MongoDocument` | no |
| `options` | `TranslateOptions` | no |

## Returns

`MongoRequest`

## Call it

```ts
import { openMemory } from 'defuss-db';
import { mongoRequest } from 'defuss-db/mongo';

const db = await openMemory();
const orders = db.collection('orders');
const result = mongoRequest(orders.q, { customer: 'ada' }, { placedAt: -1 });
```

Interactive: [mongoRequest in the app](../../../app-api-docs.html#/ref/Mongo/mongoRequest).
