# Collection.insertBatches

```ts
insertBatches(batches: AsyncIterable<readonly NewDocument<T>[]> | Iterable<readonly NewDocument<T>[]>, options?: WriteOptions): AsyncGenerator<{
    ids: PrimaryKey[];
    revision: number;
    storedEntries: number;
}>
```

Async generator of { ids, revision, storedEntries }; one atomic commit per input batch

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `batches` | `AsyncIterable<readonly NewDocument<T>[]> \| Iterable<readonly NewDocument<T>[]>` | yes |
| `options` | `WriteOptions` | no |

## Returns

`AsyncGenerator<{
        ids: PrimaryKey[];
        revision: number;
        storedEntries: number;
    }>`

## Call it

Takes an iterable of batches, which a form cannot build - the sample passes one.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
async function* batches() {
  yield [{ id: 'o-2001', customer: 'lin', total: 30, placedAt: new Date(), status: 'open', items: [], note: '' }];
  yield [{ id: 'o-2002', customer: 'lin', total: 12, placedAt: new Date(), status: 'open', items: [], note: '' }];
}
for await (const receipt of orders.insertBatches(batches())) console.log(receipt.ids, receipt.revision);
```

Interactive: [Collection.insertBatches in the app](../../../app-api-docs.html#/ref/Collection/insertBatches).
