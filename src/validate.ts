/**
 * Checks a value against a JSON Schema: `validateValue(schema, value)` lists what is violated, `checkSchema(schema)`
 * refuses a schema this file would not enforce in full. Pure and isomorphic, so a form can check a field with the
 * rule the database applies on write (collection.setSchema(), catalog.ts).
 *
 * Enforced: `type`, `enum`, `format` (`date-time`, `uri`, `path`), `properties`, `required`,
 * `additionalProperties`, `items`, `anyOf` and `x-dson`. Annotations (`title`, `description`, `examples`, `default`,
 * `$comment`, `$schema`, `$id`, `contentEncoding`, every `x-` keyword) are ignored.
 *
 * Why an own validator and not a JSON Schema library: documents are DSON values, and `x-dson` names the exact type
 * (Date, bigint, binary, Map, Set) a JSON validator does not know; with `x-dson` a value must have that type, not its
 * JSON stand-in. Why any other keyword is refused by name instead of ignored, as JSON Schema allows: a schema that
 * states `pattern` and stores a value that breaks it would promise a check nobody runs.
 * VERIFIED: tests/schema-validation.test.ts validates the documents of inferred schemas and of real collections.
 */
import { FORMATS, kindOf, type JsonSchema } from './json-schema.js';
import type { CommitOptions } from 'defuss-dbsonl';
import type { PrimaryKey } from './types.js';

/** One violated rule: where (a JSON Pointer into the value, '' for the value itself), which keyword, and why. */
export interface ValidationIssue {
  path: string;
  keyword: string;
  message: string;
}
/** How validateCollection bounds its work. */
export interface ValidateOptions {
  /** Stop after this many violating documents. Default 100. */
  limit?: number;
  signal?: CommitOptions['signal'];
}
/** What validateCollection and setSchema answer. */
export interface CollectionValidation {
  /** Documents read. */
  checked: number;
  /** Violating documents among them; equal to `limit`, the check stopped there and more may follow. */
  invalid: number;
  limit: number;
  documents: { id: PrimaryKey; issues: ValidationIssue[] }[];
  /** Present when a document violates the schema: `WARNING >= 100 documents of events violate its schema; ...` */
  warning?: string;
}

const TYPES = ['null', 'boolean', 'integer', 'number', 'string', 'object', 'array'];
/** The JSON type each DSON type stands in for. */
const DSON: Record<string, string> = {
  date: 'string',
  bigint: 'integer',
  binary: 'string',
  map: 'object',
  set: 'array',
};
const ANNOTATIONS = new Set([
  '$schema',
  '$id',
  '$comment',
  'title',
  'description',
  'examples',
  'default',
  'contentEncoding',
]);
const SUPPORTED =
  'type, enum, format, properties, required, additionalProperties, items, anyOf and x-dson';
/** Issues collected per value: a document that is wrong everywhere stays a bounded answer. */
const ISSUE_LIMIT = 100;

const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** Throws a TypeError naming the place and keyword of a schema that validateValue would not enforce in full. */
export function checkSchema(schema: unknown, at = ''): asserts schema is JsonSchema {
  const fail = (message: string): never => {
    throw new TypeError(`Schema ${at || '/'}: ${message}`);
  };
  if (!plain(schema)) return fail('a schema is an object.');
  for (const [key, value] of Object.entries(schema)) {
    if (ANNOTATIONS.has(key)) continue;
    if (key === 'x-dson') {
      if (!Object.hasOwn(DSON, value as string))
        fail(`x-dson must be one of ${Object.keys(DSON).join(', ')}.`);
      // Otherwise the schema would name a DSON type and accept the plain values of its other type.
      const stands = DSON[value as string]!;
      if (schema.type !== undefined && ![schema.type].flat().includes(stands))
        fail(`"x-dson": "${value}" stands in for type ${stands}.`);
    } else if (key.startsWith('x-')) continue;
    else if (key === 'type') {
      const list: unknown[] = Array.isArray(value) ? value : [value];
      if (!list.length || list.some((t) => !TYPES.includes(t as string)))
        fail(`type must be one of ${TYPES.join(', ')}, or a list of them.`);
    } else if (key === 'enum') {
      const scalar = (v: unknown) =>
        v === null || ['string', 'number', 'boolean'].includes(typeof v);
      if (!Array.isArray(value) || !value.length || !value.every(scalar))
        fail('enum must list strings, numbers, booleans or null.');
    } else if (key === 'format') {
      if (!Object.hasOwn(FORMATS, value as string))
        fail(
          `format ${JSON.stringify(value)} is not checked; supported: ${Object.keys(FORMATS).join(', ')}.`,
        );
    } else if (key === 'properties') {
      if (!plain(value)) return fail('properties must be an object of schemas.');
      for (const [name, sub] of Object.entries(value)) checkSchema(sub, `${at}/properties/${name}`);
    } else if (key === 'required') {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
        fail('required must list property names.');
    } else if (key === 'additionalProperties') {
      if (typeof value !== 'boolean') checkSchema(value, `${at}/additionalProperties`);
    } else if (key === 'items') checkSchema(value, `${at}/items`);
    else if (key === 'anyOf') {
      if (!Array.isArray(value) || !value.length) return fail('anyOf must list schemas.');
      value.forEach((sub, i) => checkSchema(sub, `${at}/anyOf/${i}`));
    } else if (key === 'uniqueItems') {
      // A Set is unique by construction; equality of the items of an array is not checked here.
      if (value !== false && schema['x-dson'] !== 'set')
        fail('uniqueItems is enforced only with "x-dson": "set".');
    } else fail(`"${key}" is not enforced by defuss-db; supported keywords: ${SUPPORTED}.`);
  }
}

// An enum of up to 1,000 values is asked once per document: a Set per enum array, which lives as long as its schema.
const members = new WeakMap<unknown[], Set<unknown>>();
function member(list: unknown[], value: unknown): boolean {
  if (list.length < 16) return list.includes(value);
  let set = members.get(list);
  if (!set) members.set(list, (set = new Set(list)));
  return set.has(value);
}
const shown = (value: unknown) =>
  typeof value === 'string'
    ? JSON.stringify(value)
    : typeof value === 'object' && value !== null
      ? `the ${kindOf(value)}`
      : String(value);
const pointer = (path: string, key: unknown) =>
  `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

/** What `value` violates in `schema` (a schema that passed checkSchema); empty when it conforms. */
export function validateValue(schema: JsonSchema, value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  visit(schema, value, '', issues);
  return issues;
}
function visit(schema: JsonSchema, value: unknown, path: string, issues: ValidationIssue[]): void {
  if (issues.length >= ISSUE_LIMIT) return;
  const add = (keyword: string, message: string, at = path) =>
    void issues.push({ path: at, keyword, message });
  const kind = kindOf(value);
  const dson = schema['x-dson'];
  if (schema.type !== undefined || dson) {
    const types = schema.type === undefined ? [DSON[dson!]!] : [schema.type].flat();
    const fits = types.some((t) =>
      dson && t === DSON[dson]
        ? kind === dson
        : kind === t || (t === 'number' && kind === 'integer'),
    );
    // A value of another type has no properties or items to check against this schema.
    if (!fits) return add('type', `expected ${dson ?? types.join(' or ')}, found ${kind}`);
  }
  if (schema.anyOf) {
    const fits = schema.anyOf.some((alternative) => {
      const found: ValidationIssue[] = [];
      visit(alternative, value, path, found);
      return !found.length;
    });
    if (!fits) add('anyOf', `${shown(value)} matches none of the alternatives`);
  }
  if (schema.enum && !member(schema.enum, value)) {
    const list = schema.enum.slice(0, 8).map(shown).join(', ');
    const more = schema.enum.length > 8 ? `, ... (${schema.enum.length} values)` : '';
    add('enum', `${shown(value)} is not one of ${list}${more}`);
  }
  if (
    typeof value === 'string' &&
    schema.format &&
    Object.hasOwn(FORMATS, schema.format) &&
    !FORMATS[schema.format]!(value)
  )
    add('format', `${shown(value)} is not a valid ${schema.format}`);
  if (kind === 'object') {
    const object = value as Record<string, unknown>;
    for (const name of schema.required ?? [])
      if (!Object.hasOwn(object, name) || object[name] === undefined)
        add('required', 'is required', pointer(path, name));
    const properties = schema.properties ?? {};
    for (const [name, item] of Object.entries(object)) {
      if (item === undefined) continue;
      const rule = Object.hasOwn(properties, name)
        ? properties[name]!
        : schema.additionalProperties;
      if (rule === false)
        add('additionalProperties', 'is not a declared property', pointer(path, name));
      else if (rule && rule !== true) visit(rule, item, pointer(path, name), issues);
    }
  } else if (kind === 'map') {
    const rule = schema.additionalProperties;
    if (rule && rule !== true)
      for (const [key, item] of value as Map<unknown, unknown>)
        visit(rule, item, pointer(path, key), issues);
  } else if ((kind === 'array' || kind === 'set') && schema.items) {
    let i = 0;
    for (const item of value as Iterable<unknown>)
      visit(schema.items, item, pointer(path, i++), issues);
  }
}

/** The `limit` of a bounded check: 100 by default. */
export function checkedLimit(limit = 100): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100_000)
    throw new RangeError('limit must be an integer in [1, 100000].');
  return limit;
}
/** The answer of a bounded check over documents, with its warning line. */
export function collectionValidation(
  collection: string,
  checked: number,
  limit: number,
  documents: CollectionValidation['documents'],
): CollectionValidation {
  const invalid = documents.length;
  if (!invalid) return { checked, invalid, limit, documents };
  const first = documents[0]!,
    issue = first.issues[0]!;
  const count = `${invalid === limit ? '>= ' : ''}${invalid} ${invalid === 1 ? 'document' : 'documents'}`;
  return {
    checked,
    invalid,
    limit,
    documents,
    warning:
      `WARNING ${count} of ${collection} ${invalid === 1 ? 'violates' : 'violate'} its schema; ` +
      `first: ${String(first.id)} ${issue.path || '/'} ${issue.message}`,
  };
}
