# Collection.source

```ts
source(options?: HistoryReadOptions): RecordSource<T>
```

Document-level DataView RecordSource<T>

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `HistoryReadOptions` | no |

## Returns

`RecordSource<T>`

## Call it

Returns a DataView record source for other DataView code - the sample reads it.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const source = orders.source();
// a DataView RecordSource: hand it to defuss-dataview's compute functions
```

Interactive: [Collection.source in the app](../../../app-api-docs.html#/ref/Collection/source).
