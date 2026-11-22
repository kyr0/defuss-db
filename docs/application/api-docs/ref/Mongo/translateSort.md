# translateSort

```ts
translateSort(doc: Doc): MongoSorter[]
```

The parts of findMongo.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `doc` | `Doc` | yes |

## Returns

`MongoSorter[]`

## Call it

```ts
import { translateSort } from 'defuss-db/mongo';

const result = translateSort({ placedAt: -1, id: 1 });
```

Interactive: [translateSort in the app](../../../app-api-docs.html#/ref/Mongo/translateSort).
