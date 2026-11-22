# Collection.insert

```ts
insert(value: NewDocument<T>, options?: WriteOptions): Promise<PrimaryKey>
```

Reject existing ID; return ID; omitted ID generates UUID

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `value` | `NewDocument<T>` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<PrimaryKey>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.insert({
  id: 'o-1007',
  customer: 'lin',
  total: 39,
  placedAt: new Date('2026-11-20T09:30:00.000Z'),
  status: 'open',
  items: [{ sku: 'ms-02', qty: 1 }],
  note: 'First order',
});
```

Interactive: [Collection.insert in the app](../../../app-api-docs.html#/ref/Collection/insert).
