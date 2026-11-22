# Collection.explain

```ts
explain(request?: FindRequest): Promise<{
    revision: number;
    access: AccessPlan;
    query: defuss_dataview_compute.Explain;
    history?: {
        effective: Date;
        recordedRevision: number;
        secondaryIndexes: string;
    } | undefined;
}>
```

{ revision, access, query }; access selection for the inspected snapshot

## Parameters

| Name | Type | Required |
| --- | --- | --- |
| `request` | `FindRequest` | no |

## Returns

`Promise<{
        revision: number;
        access: AccessPlan;
        query: defuss_dataview_compute.Explain;
        history?: {
            effective: Date;
            recordedRevision: number;
            secondaryIndexes: string;
        } | undefined;
    }>`

## Call it

```ts
import { openMemory } from 'defuss-db';

const db = await openMemory();
const orders = db.collection('orders');
const result = await orders.explain({ filters: [{ field: 'customer', op: 'eq', value: 'ada' }] });
```

Interactive: [Collection.explain in the app](../../../app-api-docs.html#/ref/Collection/explain).
