# Database.transaction

```ts
transaction<R>(callback: (tx: DatabaseTransaction) => R | Promise<R>, options?: WriteOptions): Promise<TransactionResult<R>>
```

{ result, revision, storedEntries }; callback runs once

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `callback` | `(tx: DatabaseTransaction) => R \| Promise<R>` | yes |
| `options` | `WriteOptions` | no |

## Returns

`Promise<TransactionResult<R>>`

## Call it

Takes a callback, which a form cannot build - the sample passes one.

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const { result, revision } = await db.transaction(async (tx) => {
  await tx.collection('orders').update('o-1002', { status: 'paid' });
  await tx.collection('customers').update('grace', { lastOrder: 'o-1002' });
  return 'paid';
});
```

Interactive: [Database.transaction in the app](../../../app-api-docs.html#/ref/Database/transaction).
