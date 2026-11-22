# Collection.pageByIndex

```ts
pageByIndex(index: string, options?: IndexPageOptions): Promise<IndexPage<T>>
```

Seek page of documents with rows, nextCursor and snapshot revision. Cursor contract

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `index` | `string` | yes |
| `options` | `IndexPageOptions` | no |

## Returns

`Promise<IndexPage<T>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.pageByIndex('byCustomer', { prefix: ['ada'], limit: 2 });
```

Interactive: [Collection.pageByIndex in the app](../../../app-api-docs.html#/ref/Collection/pageByIndex).
