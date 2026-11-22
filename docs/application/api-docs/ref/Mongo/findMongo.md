# findMongo

```ts
findMongo<T = Doc>(collection: MongoReadable, filter?: MongoDocument, options?: MongoFindOptions): Promise<T[]>
```

Projected documents. Each document argument is an object or its text.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `collection` | `MongoReadable` | yes |
| `filter` | `MongoDocument` | no |
| `options` | `MongoFindOptions` | no |

## Returns

`Promise<T[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';
import { findMongo } from 'defuss-db/mongo';

const db = await openMemory();
const orders = db.collection('orders');
const result = await findMongo(orders, { customer: 'ada', total: { $gte: 70 } }, { sort: { placedAt: -1 } });
```

Interactive: [findMongo in the app](../../../app-api-docs.html#/ref/Mongo/findMongo).
