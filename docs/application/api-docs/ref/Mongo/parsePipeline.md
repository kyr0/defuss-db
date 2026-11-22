# parsePipeline

```ts
parsePipeline(text: string): Doc[]
```

Shell or Extended JSON text as values: ISODate() and { $date } become a Date, NumberLong() and { $numberLong } a BigInt.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `text` | `string` | yes |

## Returns

`Doc[]`

## Call it

```ts
import { parsePipeline } from 'defuss-db/mongo';

const result = parsePipeline('[{ $match: { status: "paid" } }, { $count: "paid" }]');
```

Interactive: [parsePipeline in the app](../../../app-api-docs.html#/ref/Mongo/parsePipeline).
