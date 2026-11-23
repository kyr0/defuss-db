# Collection.schema

```ts
schema(): Promise<JsonSchema | undefined>
```

The JSON Schema set with setSchema, or undefined

## Returns

`Promise<JsonSchema | undefined>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.schema();
```

Interactive: [Collection.schema in the app](../../../app-api-docs.html#/ref/Collection/schema).
