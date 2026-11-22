# project

```ts
project(doc: Doc, projection: Doc): Doc
```

The parts of findMongo.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `doc` | `Doc` | yes |
| `projection` | `Doc` | yes |

## Returns

`Doc`

## Call it

```ts
import { project } from 'defuss-db/mongo';

const result = project({ id: 'o-1001', customer: 'ada', total: 120, note: 'Gift wrap, please' }, { customer: 1, total: 1 });
```

Interactive: [project in the app](../../../app-api-docs.html#/ref/Mongo/project).
