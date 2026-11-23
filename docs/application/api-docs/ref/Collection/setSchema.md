# Collection.setSchema

```ts
setSchema(schema: JsonSchema | null, options?: WriteOptions & {
    limit?: number;
}): Promise<CollectionValidation>
```

Set the JSON Schema that later writes validate against, or remove it with null; return a bounded check of the stored documents. See Schemas and validation

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `schema` | `JsonSchema \| null` | yes |
| `options` | `WriteOptions & {         limit?: number;     }` | no |

## Returns

`Promise<CollectionValidation>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.setSchema(null);
```

Interactive: [Collection.setSchema in the app](../../../app-api-docs.html#/ref/Collection/setSchema).
