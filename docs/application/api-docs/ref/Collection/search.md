# Collection.search

```ts
search(index: string, query: DocumentSearchQuery, options?: SearchRequest): Promise<DocumentSearchResult<T>>
```

Revision-bound scored hits; see Search

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `index` | `string` | yes |
| `query` | `DocumentSearchQuery` | yes |
| `options` | `SearchRequest` | no |

## Returns

`Promise<DocumentSearchResult<T>>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.search('notes', { text: 'gift wrap' });
```

Interactive: [Collection.search in the app](../../../app-api-docs.html#/ref/Collection/search).
