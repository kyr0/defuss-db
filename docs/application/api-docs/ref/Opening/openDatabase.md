# openDatabase

```ts
openDatabase(backend: Backend, options?: OpenOptions): Promise<Database>
```

From defuss-db. Arguments: Coordinated DBSONL Backend, OpenOptions?.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `backend` | `Backend` | yes |
| `options` | `OpenOptions` | no |

## Returns

`Promise<Database>`

## Call it

Takes a DBSONL backend, which a form cannot build - the sample passes one.

```ts
import { createMemoryBackend, openDatabase } from 'defuss-db';

const db = await openDatabase(createMemoryBackend(), { name: 'scratch' });
```

Interactive: [openDatabase in the app](../../../app-api-docs.html#/ref/Opening/openDatabase).
