# translatePipeline

```ts
translatePipeline(stages: readonly Doc[]): PipelinePlan
```

The plan of a pipeline (match, keys, measures, sort, limit) / its aggregate descriptor.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `stages` | `readonly Doc[]` | yes |

## Returns

`PipelinePlan`

## Call it

```ts
import { translatePipeline } from 'defuss-db/mongo';

const result = translatePipeline([
  { $match: { status: 'paid' } },
  { $group: { _id: '$customer', revenue: { $sum: '$total' } } },
]);
```

Interactive: [translatePipeline in the app](../../../app-api-docs.html#/ref/Mongo/translatePipeline).
