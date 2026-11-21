export function getPath(row: object, path: string): unknown {
  if (!path.includes('.'))
    return Object.hasOwn(row, path) ? (row as Record<string, unknown>)[path] : undefined;
  let value: unknown = row;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part))
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
