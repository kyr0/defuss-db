# aggregateDescriptor

```ts
aggregateDescriptor(plan: PipelinePlan, q: unknown, options?: TranslateOptions): Doc
```

The plan of a pipeline (match, keys, measures, sort, limit) / its aggregate descriptor.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `plan` | `PipelinePlan` | yes |
| `q` | `unknown` | yes |
| `options` | `TranslateOptions` | no |

## Returns

`Doc`

## Call it

```ts
import { openMemory } from 'defuss-db';
import { aggregateDescriptor } from 'defuss-db/mongo';

const db = await openMemory();
const orders = db.collection('orders');
const result = aggregateDescriptor({
  match: { status: 'paid' },
  keys: [{ name: null, field: 'customer', by: 'value' }],
  measures: [{ alias: 'revenue', op: 'sum', field: 'total' }],
  sort: { by: 'measure', direction: 'desc' },
  sorted: false,
  limit: null,
  count: null,
});
```

Interactive: [aggregateDescriptor in the app](../../../app-api-docs.html#/ref/Mongo/aggregateDescriptor).
