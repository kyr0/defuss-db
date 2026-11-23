# Collection.put

```ts
put(value: Replacement<T>, options?: DocumentWriteOptions): Promise<PrimaryKey>
```

Insert or replace whole document with required ID; return ID

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `value` | `Replacement<T>` | yes |
| `options` | `DocumentWriteOptions` | no |

## Returns

`Promise<PrimaryKey>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.put({
  id: 'o-1002',
  customer: 'grace',
  total: 45,
  placedAt: new Date('2026-11-04T09:30:00.000Z'),
  status: 'paid',
  items: [{ sku: 'ms-02', qty: 1 }],
  note: 'Leave it at the door',
});
```

Interactive: [Collection.put in the app](../../../app-api-docs.html#/ref/Collection/put).
