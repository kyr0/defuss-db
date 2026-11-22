# Database.exportStream

```ts
exportStream(options?: ExportOptions): AsyncGenerator<Uint8Array>
```

Pull-driven AsyncGenerator<Uint8Array> holding one snapshot

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `ExportOptions` | no |

## Returns

`AsyncGenerator<Uint8Array>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
for await (const value of db.exportStream()) console.log(value);
```

Interactive: [Database.exportStream in the app](../../../app-api-docs.html#/ref/Database/exportStream).
