# Collection.insertMany

```ts
insertMany(values: readonly NewDocument<T>[], options?: WriteOptions): Promise<PrimaryKey[]>
```

One atomic bounded batch; return IDs

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `values` | `readonly NewDocument<T>[]` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<PrimaryKey[]>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.insertMany([
  {
    id: 'o-1008',
    customer: 'lin',
    total: 12,
    placedAt: new Date('2026-11-21T09:30:00.000Z'),
    status: 'open',
    items: [{ sku: 'pd-03', qty: 1 }],
    note: '',
  },
  {
    id: 'o-1009',
    customer: 'alan',
    total: 99,
    placedAt: new Date('2026-11-21T09:30:00.000Z'),
    status: 'paid',
    items: [{ sku: 'kb-01', qty: 1 }],
    note: 'Spare keyboard',
  },
]);
```

Interactive: [Collection.insertMany in the app](../../../app-api-docs.html#/ref/Collection/insertMany).
