# openDirectory

```ts
openDirectory(directory: string, options?: DirectoryOptions): Promise<Database>
```

From defuss-db/server. Arguments: Root path, OpenOptions & { storage?: FileBackendOptions; parallel?: boolean | ParallelOptions }.

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `directory` | `string` | yes |
| `options` | `DirectoryOptions` | no |

## Returns

`Promise<Database>`

## Call it

Opens a directory on disk, so it runs in Node.js and Bun - not in this page.

```ts
import { openDirectory } from 'defuss-db/server';

const db = await openDirectory('./data');
```

Interactive: [openDirectory in the app](../../../app-api-docs.html#/ref/Opening/openDirectory).
