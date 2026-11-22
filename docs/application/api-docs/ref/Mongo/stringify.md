# stringify

```ts
stringify(value: unknown, space?: number | string): string
```

Values as Extended JSON text and back.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `value` | `unknown` | yes |
| `space` | `number \| string` | no |

## Returns

`string`

## Call it

```ts
import { stringify } from 'defuss-db/mongo';

const result = stringify({
  id: 'o-1001',
  total: 120n,
  placedAt: new Date('2026-11-02T09:30:00.000Z'),
});
```

Interactive: [stringify in the app](../../../app-api-docs.html#/ref/Mongo/stringify).
