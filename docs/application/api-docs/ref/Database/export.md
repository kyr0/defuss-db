# Database.export

```ts
export(options?: ExportOptions): Promise<Uint8Array>
```

Uint8Array Brotli archive; buffered, default 64 MiB compressed cap

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `ExportOptions` | no |

## Returns

`Promise<Uint8Array>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await db.export();
```

Interactive: [Database.export in the app](../../../app-api-docs.html#/ref/Database/export).
