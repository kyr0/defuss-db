/**
 * The shape of a collection as a JSON Schema (draft 2020-12), inferred from a sample of its documents:
 * `analyzeSchema(collection, { sample, at })`. With `at` the sample is the collection as it was at that instant
 * (a collection that tracks history; see docs/HISTORY.md) - the schema at a time, to compare two of them or to see
 * when a field appeared.
 *
 * Why a sample spread over the collection instead of its first documents: documents come back in id order, and ids
 * often follow insertion time, so the first N show only the oldest shape. The sample reads eight windows at even
 * offsets across the whole collection. Why JSON Schema: every validator, form generator and code generator reads it;
 * the values JSON has no type for keep a JSON type plus `x-dson` (date, bigint, binary, map, set), so a reader that
 * knows DSON gets the exact type and every other reader a correct JSON one.
 * Annotations: `x-presence` - the share of the enclosing objects that hold a property, where it is below 1 (a
 * property every sampled object holds is `required`); `examples` - up to three distinct scalar values.
 * VERIFIED: tests/json-schema.test.ts infers schemas of real memory collections, also at an earlier date.
 */

/** A JSON Schema object (the keywords used here, plus any other). */
export interface JsonSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  format?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: JsonSchema;
  items?: JsonSchema;
  uniqueItems?: boolean;
  anyOf?: JsonSchema[];
  examples?: unknown[];
  contentEncoding?: string;
  $comment?: string;
  'x-dson'?: 'date' | 'bigint' | 'binary' | 'map' | 'set';
  'x-presence'?: number;
  [keyword: string]: unknown;
}
/** How a schema is inferred from documents. */
export interface InferOptions {
  /** The schema's title (analyzeSchema: the collection's name). */
  title?: string;
  /** Objects deeper than this are `{ type: 'object' }` without properties. Default 12. */
  maxDepth?: number;
  /** Distinct example values kept per scalar type. Default 3; 0 keeps none. */
  examples?: number;
}
/** How analyzeSchema samples a collection. */
export interface AnalyzeSchemaOptions extends InferOptions {
  /** Documents to read at most. Default 1,000. */
  sample?: number;
  /** The collection as it was at this instant (history must be tracked). */
  at?: Date;
  /** With `at`: what was recorded up to this revision (see docs/HISTORY.md). */
  $asOfRevision?: unknown;
}
/** What analyzeSchema answers. */
export interface AnalyzedSchema {
  schema: JsonSchema;
  /** Documents read. */
  sampled: number;
  /** Documents in the collection (at `at`). */
  total: number;
  at: Date | null;
}
/** The part of a collection analyzeSchema uses. */
export interface SchemaReadable {
  readonly name?: string;
  count(): Promise<number>;
  find(request?: object): Promise<unknown[]>;
  at?(date: Date, options?: object): SchemaReadable;
}

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';
const WINDOWS = 8;

type Kind =
  | 'null'
  | 'boolean'
  | 'integer'
  | 'number'
  | 'string'
  | 'date'
  | 'bigint'
  | 'binary'
  | 'object'
  | 'array'
  | 'map'
  | 'set'
  | 'cycle'
  | 'other';
/** Everything seen at one place of the documents. */
interface Node {
  /** How many values were seen here. */
  seen: number;
  kinds: Map<Kind, Acc>;
}
interface Acc {
  count: number;
  examples: unknown[];
  /** object: the properties, each with how many objects held it */
  props?: Map<string, Node>;
  /** array / set items, map values */
  items?: Node;
}

const node = (): Node => ({ seen: 0, kinds: new Map() });
function kindOf(v: unknown): Kind {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'bigint') return 'bigint';
  if (v instanceof Date) return 'date';
  if (v instanceof Map) return 'map';
  if (v instanceof Set) return 'set';
  if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return 'binary';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return 'other';
}

/** The JSON Schema of documents (objects): what every analyzed sample becomes. */
export function inferSchema(docs: readonly unknown[], options: InferOptions = {}): JsonSchema {
  const maxDepth = options.maxDepth ?? 12;
  const keep = options.examples ?? 3;
  const root = node();
  // the objects on the way down: a value that contains itself is a cycle, not an infinite schema
  const path = new Set<object>();
  const add = (n: Node, v: unknown, depth: number) => {
    if (v === undefined) return;
    n.seen++;
    let kind = kindOf(v);
    if (typeof v === 'object' && v !== null && path.has(v)) kind = 'cycle';
    let acc = n.kinds.get(kind);
    if (!acc) n.kinds.set(kind, (acc = { count: 0, examples: [] }));
    acc.count++;
    const scalar = ['boolean', 'integer', 'number', 'string', 'date', 'bigint'].includes(kind);
    if (scalar && acc.examples.length < keep) {
      const shown = v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? String(v) : v;
      if (!acc.examples.includes(shown)) acc.examples.push(shown);
    }
    if (kind === 'cycle' || depth >= maxDepth) return;
    const inner = (fn: () => void) => {
      path.add(v as object);
      fn();
      path.delete(v as object);
    };
    if (kind === 'object')
      inner(() => {
        acc.props ??= new Map();
        for (const [k, x] of Object.entries(v as object)) {
          if (x === undefined) continue;
          let p = acc.props.get(k);
          if (!p) acc.props.set(k, (p = node()));
          add(p, x, depth + 1);
        }
      });
    else if (kind === 'array' || kind === 'set' || kind === 'map')
      inner(() => {
        acc.items ??= node();
        const values =
          kind === 'map' ? (v as Map<unknown, unknown>).values() : (v as Iterable<unknown>);
        for (const x of values) add(acc.items, x, depth + 1);
      });
  };
  for (const d of docs) add(root, d, 0);
  const schema: JsonSchema = { $schema: JSON_SCHEMA_DIALECT };
  if (options.title) schema.title = options.title;
  const object = root.kinds.get('object');
  return object ? { ...schema, ...emitKind('object', object) } : { ...schema, type: 'object' };
}

/** The schema of everything seen at one place. */
function emit(n: Node): JsonSchema {
  const kinds = [...n.kinds.entries()];
  // an integer is a number: where both were seen, number says it
  const number = n.kinds.get('number');
  const integer = n.kinds.get('integer');
  const merged = kinds
    .filter(([k]) => !(k === 'integer' && number))
    .map(([k, acc]): [Kind, Acc] =>
      k === 'number' && integer
        ? [
            k,
            {
              ...acc,
              examples: [...acc.examples, ...integer.examples].slice(
                0,
                Math.max(acc.examples.length, 3),
              ),
            },
          ]
        : [k, acc],
    );
  const parts = merged.map(([k, acc]) => emitKind(k, acc));
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0]!;
  // plain types (with examples at most) list as one type array, the rest as anyOf
  const plain = parts.every((p) => Object.keys(p).every((k) => k === 'type' || k === 'examples'));
  if (plain) {
    const examples = parts.flatMap((p) => p.examples ?? []).slice(0, 3);
    return { type: parts.map((p) => p.type as string), ...(examples.length ? { examples } : {}) };
  }
  return { anyOf: parts };
}

function emitKind(kind: Kind, acc: Acc): JsonSchema {
  const examples = acc.examples.length ? { examples: acc.examples } : {};
  switch (kind) {
    case 'null':
      return { type: 'null' };
    case 'boolean':
    case 'integer':
    case 'number':
    case 'string':
      return { type: kind, ...examples };
    case 'date':
      return { type: 'string', format: 'date-time', 'x-dson': 'date', ...examples };
    case 'bigint':
      return { type: 'integer', 'x-dson': 'bigint', ...examples };
    case 'binary':
      return { type: 'string', contentEncoding: 'base64', 'x-dson': 'binary' };
    case 'array':
      return { type: 'array', ...(acc.items?.seen ? { items: emit(acc.items) } : {}) };
    case 'set':
      return {
        type: 'array',
        uniqueItems: true,
        'x-dson': 'set',
        ...(acc.items?.seen ? { items: emit(acc.items) } : {}),
      };
    case 'map':
      return {
        type: 'object',
        'x-dson': 'map',
        ...(acc.items?.seen ? { additionalProperties: emit(acc.items) } : {}),
      };
    case 'object': {
      if (!acc.props) return { type: 'object' };
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [k, p] of acc.props) {
        const s = emit(p);
        if (p.seen === acc.count) required.push(k);
        else s['x-presence'] = Math.round((p.seen / acc.count) * 1000) / 1000;
        properties[k] = s;
      }
      return { type: 'object', properties, ...(required.length ? { required } : {}) };
    }
    case 'cycle':
      return { $comment: 'a reference back to an enclosing value (a DSON cycle)' };
    default:
      return {};
  }
}

/**
 * Samples a collection (spread over all of it) and infers its JSON Schema. With `at`, the collection as it was at
 * that instant: a collection without history throws HISTORY_NOT_ENABLED.
 */
export async function analyzeSchema(
  collection: SchemaReadable,
  options: AnalyzeSchemaOptions = {},
): Promise<AnalyzedSchema> {
  const { sample = 1000, at, $asOfRevision, ...infer } = options;
  if (!Number.isInteger(sample) || sample < 1)
    throw new RangeError('sample must be a whole number above 0');
  if (at !== undefined && (!(at instanceof Date) || Number.isNaN(at.getTime())))
    throw new TypeError('at must be a valid Date');
  let source = collection;
  if (at) {
    if (typeof collection.at !== 'function')
      throw new TypeError('this collection reads no history');
    source = collection.at(at, $asOfRevision === undefined ? {} : { $asOfRevision });
  }
  const total = await source.count();
  const docs: unknown[] = [];
  if (total <= sample) docs.push(...(await source.find({ limit: sample })));
  else {
    // eight windows at even offsets: the start, the end and six places between
    const size = Math.ceil(sample / WINDOWS);
    for (let w = 0; w < WINDOWS && docs.length < sample; w++) {
      const offset = Math.floor((w * (total - size)) / (WINDOWS - 1));
      docs.push(...(await source.find({ offset, limit: Math.min(size, sample - docs.length) })));
    }
  }
  const schema = inferSchema(docs, { ...infer, title: infer.title ?? collection.name });
  schema.description =
    `Inferred from ${docs.length} of ${total} documents` +
    (at ? ` as of ${at.toISOString()}` : '') +
    '.';
  return { schema, sampled: docs.length, total, at: at ?? null };
}
