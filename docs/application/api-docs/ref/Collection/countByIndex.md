# Collection.countByIndex

```ts
countByIndex(index: string, options?: IndexCountOptions): Promise<number>
```

Exact number of ordered index entries matching prefix and bounds. Optional maxScannedEntries rejects excessive work. Accepts an abort signal.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `index` | `string` | yes |
| `options` | `IndexCountOptions` | no |

## Returns

`Promise<number>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.countByIndex('byCustomer', { prefix: ['ada'] });
```

Interactive: [Collection.countByIndex in the app](../../../app-api-docs.html#/ref/Collection/countByIndex).
