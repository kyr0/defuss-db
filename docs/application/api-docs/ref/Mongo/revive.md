# revive

```ts
revive(value: unknown): unknown
```

Values as Extended JSON text and back.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `value` | `unknown` | yes |

## Returns

`unknown`

## Call it

```ts
import { revive } from 'defuss-db/mongo';

const result = revive({
  placedAt: { $date: '2026-11-02T09:30:00Z' },
  total: { $numberLong: '120' },
});
```

Interactive: [revive in the app](../../../app-api-docs.html#/ref/Mongo/revive).
