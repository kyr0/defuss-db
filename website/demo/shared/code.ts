// TypeScript source text for the values a worker call used, so the inspector shows the call that produced a view
// with its real arguments rather than a paraphrase. Only the value kinds the demo passes are covered: strings, numbers,
// bigints, booleans, Dates, arrays and plain objects.

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const WIDTH = 72;

/** An integer as written in source: underscores group the digits from 10,000 on. */
function integerText(value: number | bigint): string {
  const text = String(value);
  return text.replace(/^-/, '').length < 5 ? text : text.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

function dateText(date: Date): string {
  const iso = date.toISOString();
  return `new Date('${iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso}')`;
}

/** A value as a TypeScript literal; nested lines are indented by `depth` levels of two spaces. */
export function ts(value: unknown, depth = 0): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number')
    return Number.isInteger(value) ? integerText(value) : String(value);
  if (typeof value === 'bigint') return `${integerText(value)}n`;
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return dateText(value);
  const pad = '  '.repeat(depth + 1);
  const end = '  '.repeat(depth);
  if (Array.isArray(value)) {
    const items = value.map((item) => ts(item, depth + 1));
    const flat = `[${items.join(', ')}]`;
    return flat.length + pad.length <= WIDTH && !flat.includes('\n')
      ? flat
      : `[\n${items.map((item) => pad + item).join(',\n')},\n${end}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${IDENTIFIER.test(key) ? key : ts(key)}: ${ts(item, depth + 1)}`);
  if (!entries.length) return '{}';
  const flat = `{ ${entries.join(', ')} }`;
  return flat.length + pad.length <= WIDTH && !flat.includes('\n')
    ? flat
    : `{\n${entries.map((entry) => pad + entry).join(',\n')},\n${end}}`;
}
