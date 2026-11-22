# Collection.at

```ts
at(date: Date, options?: {
    $until?: Date;
    $asOfRevision?: undefined;
}): Collection<T>
at(date: Date, options: Omit<HistoryWriteOptions, '$historic'>): ReadCollection<T>
```

The collection at an effective date: reads see the documents of that instant, and on a live collection that tracks history, writes take effect then. { $asOfRevision } reads only what that revision recorded. See Document history

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `date` | `Date` | yes |
| `options` | `{         $until?: Date;         $asOfRevision?: undefined;     }` | no |

## Returns

`Collection<T>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = orders.at(new Date('2026-11-10T09:30:00.000Z'));
```

Interactive: [Collection.at in the app](../../../app-api-docs.html#/ref/Collection/at).
