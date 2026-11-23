# Collection.validateCollection

```ts
validateCollection(options?: ValidateOptions): Promise<CollectionValidation>
```

{ checked, invalid, limit, documents, warning? } after reading documents in key order until limit (default 100, at most 100,000) violate the schema

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `ValidateOptions` | no |

## Returns

`Promise<CollectionValidation>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.validateCollection();
```

Interactive: [Collection.validateCollection in the app](../../../app-api-docs.html#/ref/Collection/validateCollection).
