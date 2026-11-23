# Collection.validateDocument

```ts
validateDocument(id: PrimaryKey): Promise<ValidationIssue[]>
```

The rules one document violates, as { path, keyword, message }[]; empty when it conforms or no schema is set; NOT_FOUND for a missing id

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `id` | `PrimaryKey` | yes |

## Returns

`Promise<ValidationIssue[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.validateDocument('o-1001');
```

Interactive: [Collection.validateDocument in the app](../../../app-api-docs.html#/ref/Collection/validateDocument).
