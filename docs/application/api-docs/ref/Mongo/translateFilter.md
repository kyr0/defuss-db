# translateFilter

```ts
translateFilter(doc: Doc, q: Builders, options?: TranslateOptions): Translated
```

The parts of findMongo.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `doc` | `Doc` | yes |
| `q` | `Builders` | yes |
| `options` | `TranslateOptions` | no |

## Returns

`Translated`

## Call it

```ts
import { openMemory } from 'defuss-db';
import { translateFilter } from 'defuss-db/mongo';

const db = await openMemory();
const orders = db.collection('orders');
const result = translateFilter({ customer: 'ada', 'items.sku': 'kb-01' });
```

Interactive: [translateFilter in the app](../../../app-api-docs.html#/ref/Mongo/translateFilter).
