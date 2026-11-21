// Timing and access-plan text for the inspector. The worker times its own database calls, so the figure excludes the
// message round trip and the page's rendering.
import type { AccessPlan } from 'defuss-db';

export const now = () => performance.now();

/** Runs `call` and returns its value with the milliseconds it took. */
export async function timed<T>(call: () => Promise<T>): Promise<[T, number]> {
  const started = now();
  const value = await call();
  return [value, now() - started];
}

/** explain().access as one line of prose. */
export function describeAccess(access: AccessPlan): string {
  switch (access.kind) {
    case 'scan':
      return 'collection scan in storage order: no declared index fits';
    case 'primary':
      return 'primary key: one direct read';
    case 'primary-in':
      return `primary keys: ${access.pointKeys ?? 0} direct reads`;
    case 'equality':
      return `equality index ${access.index}`;
    case 'range':
      return `range on index ${access.index}, ${access.pointKeys ?? 0} pointers probed`;
    case 'ordered':
      return `ordered index ${access.index}, equality prefix ${access.equalityPrefix ?? 0}${
        access.rangeField ? `, range on ${access.rangeField}` : ''
      }`;
  }
}

export const plural = (n: number, word: string, many = word + 's') =>
  `${n.toLocaleString('en')} ${n === 1 ? word : many}`;
