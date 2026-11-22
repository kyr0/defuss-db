# Collection.pageIdsByIndex

```ts
pageIdsByIndex(index: string, options?: IndexPageOptions): Promise<IndexPage<T['id']>>
```

Keyset page of typed primary IDs. Returns { rows, nextCursor, revision }. Accepts document-page cursors for the same scope and range.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `index` | `string` | yes |
| `options` | `IndexPageOptions` | no |

## Returns

`Promise<IndexPage<T['id']>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.pageIdsByIndex('byCustomer', { prefix: ['ada'], limit: 2 });
```

Interactive: [Collection.pageIdsByIndex in the app](../../../app-api-docs.html#/ref/Collection/pageIdsByIndex).
