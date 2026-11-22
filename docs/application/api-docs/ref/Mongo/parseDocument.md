# parseDocument

```ts
parseDocument(text: string, what?: string): Doc
```

Shell or Extended JSON text as values: ISODate() and { $date } become a Date, NumberLong() and { $numberLong } a BigInt.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `text` | `string` | yes |
| `what` | `string` | no |

## Returns

`Doc`

## Call it

```ts
import { parseDocument } from 'defuss-db/mongo';

const result = parseDocument('{ placedAt: ISODate("2026-11-02T09:30:00Z"), total: NumberLong(120) }');
```

Interactive: [parseDocument in the app](../../../app-api-docs.html#/ref/Mongo/parseDocument).
