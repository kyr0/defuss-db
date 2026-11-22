# openOPFS

```ts
openOPFS(options?: BrowserOptions): Promise<Database>
```

From defuss-db/browser. Arguments: OpenOptions & { namespace?: string; storage?: OPFSStorageOptions without name }.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `options` | `BrowserOptions` | no |

## Returns

`Promise<Database>`

## Call it

Runs in a dedicated browser worker - this page keeps its sample database in memory.

```ts
import { openOPFS } from 'defuss-db/browser';

const db = await openOPFS({ namespace: 'shop' });
```

Interactive: [openOPFS in the app](../../../app-api-docs.html#/ref/Opening/openOPFS).
