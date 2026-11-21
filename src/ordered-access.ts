import { checkedKey, indexPrefix, range } from './keys.js';
import { orderBody, orderComponent } from './ordered-key.js';
import { DatabaseError } from './errors.js';
import type { IndexDefinition, IndexDirection, Selection } from './types.js';

export type Bounds = { gte: string; lt: string };
export type Inequality = 'gt' | 'gte' | 'lt' | 'lte';
export const rangeOps = ['gt', 'gte', 'lt', 'lte'] as const;
export type Sort = { field: string; direction: IndexDirection };
export interface AccessSelection extends Selection {
  sorters?: readonly Sort[];
}
export type BoundTerm = { op: Inequality; body: string };

/** A single half-open B+tree interval for an equality prefix and intersected bounds on its next component. */
export function orderedSpan(
  collection: string,
  index: IndexDefinition,
  prefix: readonly string[],
  terms: readonly BoundTerm[],
): Bounds {
  const directions = index.order!;
  if (prefix.length > directions.length || (terms.length && prefix.length === directions.length))
    throw new RangeError('Index bounds exceed the indexed tuple width.');
  let base = indexPrefix(collection, index);
  for (let i = 0; i < prefix.length; i++)
    base = checkedKey(base + orderComponent(prefix[i]!, directions[i]!));
  const span = range(base);
  const direction = directions[prefix.length];
  for (const { op, body } of terms) {
    const bucket = checkedKey(base + orderComponent(body, direction!));
    const greater = op === 'gt' || op === 'gte';
    const lower = direction === 'asc' ? greater : !greater;
    const inclusive = op === 'gte' || op === 'lte';
    const end = lower === inclusive ? bucket : range(bucket).lt;
    if (lower && end > span.gte) span.gte = end;
    if (!lower && end < span.lt) span.lt = end;
  }
  return span;
}

export function orderedAccess(
  collection: string,
  indexes: readonly IndexDefinition[],
  selection: AccessSelection,
  equals: Map<string, unknown>,
) {
  if (selection.semantics?.strings === 'locale') return;
  let best:
    | {
        index: IndexDefinition;
        bounds: Bounds;
        direct: boolean;
        equalityPrefix: number;
        rangeField?: string;
      }
    | undefined;
  const sorting = selection.sorters ?? [];
  for (const index of indexes) {
    if (!index.order) continue;
    let fixed = 0;
    while (fixed < index.fields.length && equals.has(index.fields[fixed]!)) fixed++;
    const constants = index.fields.slice(0, fixed);
    const rest = sorting.filter((sort) => !constants.includes(sort.field));
    // Unconstrained extra fields can reorder tied rows. Only certify the complete varying suffix.
    const direct =
      rest.length === index.fields.length - fixed &&
      rest.every(
        (sort, i) =>
          sort.field === index.fields[fixed + i] && sort.direction === index.order![fixed + i],
      );
    const next = index.fields[fixed];
    try {
      const terms: BoundTerm[] = [];
      for (const filter of selection.filters ?? [])
        if (filter.field === next && rangeOps.includes(filter.op as Inequality))
          terms.push({ op: filter.op as Inequality, body: orderBody(filter.value) });
      if (!direct && !fixed && !terms.length) continue;
      const prefix = constants.map((field) => orderBody(equals.get(field)));
      const bounds = orderedSpan(collection, index, prefix, terms);
      if (
        !best ||
        (direct && !best.direct) ||
        (direct === best.direct &&
          (fixed > best.equalityPrefix ||
            (fixed === best.equalityPrefix && terms.length && !best.rangeField)))
      )
        best = {
          index,
          bounds,
          direct,
          equalityPrefix: fixed,
          ...(terms.length ? { rangeField: next } : {}),
        };
    } catch (error) {
      // Valid query operands may fall outside the persisted index's representable domain.
      if (
        !(
          error instanceof RangeError ||
          (error instanceof DatabaseError && error.code === 'INVALID_INDEX_VALUE')
        )
      )
        throw error;
    }
  }
  return best;
}
