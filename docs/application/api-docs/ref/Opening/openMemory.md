# openMemory

```ts
openMemory(options?: OpenOptions): Promise<Database>
```

From defuss-db. Arguments: OpenOptions?.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `OpenOptions` | no |

## Returns

`Promise<Database>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory({ name: 'scratch' });
```

Interactive: [openMemory in the app](../../../app-api-docs.html#/ref/Opening/openMemory).
