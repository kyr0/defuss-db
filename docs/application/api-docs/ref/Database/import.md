# Database.import

```ts
import(input: ArchiveInput, options?: ImportOptions): Promise<ImportResult>
```

Atomic archive import and index rebuild; receipt with counts/revisions

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `input` | `ArchiveInput` | yes |
| `options` | `ImportOptions` | no |

## Returns

`Promise<ImportResult>`

## Call it

Takes the bytes of an archive - the sample imports what export() wrote.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const bytes = await db.export();
const copy = await openMemory({ name: 'copy' });
const receipt = await copy.import(bytes);
```

Interactive: [Database.import in the app](../../../app-api-docs.html#/ref/Database/import).
