# Collection.createSearchIndex

```ts
createSearchIndex(index: SearchIndexDefinition, options?: WriteOptions): Promise<void>
```

Atomic lexical/vector/hybrid build; see Search

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `index` | `SearchIndexDefinition` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<void>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.createSearchIndex({
  name: 'customers',
  kind: 'lexical',
  text: { fields: { customer: { path: 'customer' } } },
});
```

Interactive: [Collection.createSearchIndex in the app](../../../app-api-docs.html#/ref/Collection/createSearchIndex).
