# Opening

Functions that open a database: in memory or on a DBSONL backend (defuss-db), in a directory (defuss-db/server, Node.js and Bun) or in OPFS (defuss-db/browser, a dedicated worker). Each returns a Database.

| Member | Signature | Description |
| --- | --- | --- |
| [openMemory](Opening/openMemory.md) | `openMemory(options?: OpenOptions): Promise<Database>` | From defuss-db. Arguments: OpenOptions?. |
| [openDatabase](Opening/openDatabase.md) | `openDatabase(backend: Backend, options?: OpenOptions): Promise<Database>` | From defuss-db. Arguments: Coordinated DBSONL Backend, OpenOptions?. |
| [openDirectory](Opening/openDirectory.md) | `openDirectory(directory: string, options?: DirectoryOptions): Promise<Database>` | From defuss-db/server. Arguments: Root path, OpenOptions & { storage?: FileBackendOptions; parallel?: boolean \| ParallelOptions }. |
| [openOPFS](Opening/openOPFS.md) | `openOPFS(options?: BrowserOptions): Promise<Database>` | From defuss-db/browser. Arguments: OpenOptions & { namespace?: string; storage?: OPFSStorageOptions without name }. |

Interactive: [Opening in the app](../../app-api-docs.html#/ref/Opening).
