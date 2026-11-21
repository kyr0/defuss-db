/**
 * A MongoDB aggregation pipeline over defuss-db: `aggregateMongo(collection, pipeline)` runs what Compass, a driver
 * or a Stack Overflow answer writes and answers with MongoDB's result shape ({ _id, ...accumulators }).
 *
 * Why a translation into one aggregate instead of a stage-by-stage engine: defuss-db answers one filter, one
 * grouping and measures in a single pass (a full-scan aggregate even runs in parallel workers), so a pipeline maps
 * onto that exactly or not at all. A stage with no place in it ($lookup, a $match after the $group) is refused by
 * name instead of being run differently. `translatePipeline` returns the plan, so a builder UI can show it.
 * Read: $match (several become $and), $unwind (only as a group key: one group per element), $group (_id: a field, a
 * document of fields, $toLower / $toUpper, $dateTrunc, $dateToString, $year; $sum, $count, $avg, $min, $max,
 * $addToSet), $size of an $addToSet in $set / $addFields / $project, $sort (one key), $limit and the $count stage.
 * VERIFIED: tests/mongo.test.ts converts each shape, runs it on a memory database and names what it refuses.
 */
import { mongoRequest, parseDocument, QueryError } from './mongo-query.js';

type Doc = Record<string, unknown>;
/** How a group key reads its field: the value, case-folded text, one group per array element, a calendar unit. */
export type GroupUnit =
  | 'value'
  | 'lower'
  | 'upper'
  | 'each'
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour';
/** One group key of a pipeline's $group. */
export interface PipelineKey {
  /** Its name in `_id: { name: ... }`; null for `_id: '$field'` or one operator expression. */
  name: string | null;
  field: string;
  by: GroupUnit;
  /** How MongoDB writes the key: a number for $year, a string for $dateToString's format, else the value. */
  output?: { year: true } | { format: string };
  /** The IANA time zone of a calendar key ($dateTrunc or $dateToString `timezone`); UTC when absent. */
  zone?: string;
}
/** One accumulator of a pipeline's $group (or the $count stage). */
export interface PipelineMeasure {
  alias: string;
  op: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct' | 'countDistinct';
  /** count: the documents that hold this field; the others: the field they read. */
  field?: string;
}
/** What a pipeline becomes. */
export interface PipelinePlan {
  /** The $match stages as one filter (null: none). */
  match: Doc | null;
  keys: PipelineKey[];
  /** In the order the $group writes them, a measure the $sort names first. */
  measures: PipelineMeasure[];
  /** By a key (its index in keys) or by the first measure. */
  sort:
    | { by: 'key'; key: number; direction: 'asc' | 'desc' }
    | { by: 'measure'; direction: 'asc' | 'desc' };
  /** Whether the pipeline wrote a $sort at all. */
  sorted: boolean;
  limit: number | null;
  /** The $count stage's field name: the answer is `[{ [count]: n }]` and no row when nothing matched. */
  count: string | null;
}
/** The part of a collection aggregateMongo uses. */
export interface MongoAggregatable {
  readonly q: unknown;
  aggregate(descriptor: object, page?: object): Promise<{ rows: readonly unknown[] }>;
}

const isDoc = (v: unknown): v is Doc =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
const UNITS = ['year', 'quarter', 'month', 'week', 'day', 'hour'] as const;
const FORMATS: Record<string, GroupUnit> = {
  '%Y': 'year',
  '%Y-%m': 'month',
  '%Y-%m-%d': 'day',
  '%Y-%m-%dT%H': 'hour',
};

/** Reads a pipeline's text (a list of stages, or one stage) as the shell or Extended JSON writes it. */
export function parsePipeline(text: string): Doc[] {
  const t = text.trim();
  if (!t)
    throw new QueryError('pipeline: paste a list of stages, [ { $match: ... }, { $group: ... } ]');
  const value = t.startsWith('[')
    ? parseDocument(`{ "stages": ${t} }`, 'pipeline').stages
    : [parseDocument(t, 'pipeline')];
  if (!Array.isArray(value) || !value.every(isDoc))
    throw new QueryError('pipeline: every stage is a document { $stage: ... }');
  return value as Doc[];
}

/** The plan of a pipeline; a stage or an expression with no place in one aggregate throws, naming it. */
export function translatePipeline(stages: readonly Doc[]): PipelinePlan {
  const fail = (i: number, msg: string): never => {
    throw new QueryError(`stage ${i + 1}: ${msg}`);
  };
  const field = (i: number, v: unknown, what: string): string =>
    typeof v === 'string' && v.startsWith('$') && v.length > 1 && !v.startsWith('$$')
      ? v.slice(1)
      : fail(i, `${what} takes a field reference such as '$amount', not ${JSON.stringify(v)}`);
  const matches: Doc[] = [];
  const unwound = new Set<string>();
  let keys: PipelineKey[] | null = null;
  let measures: PipelineMeasure[] = [];
  let sort: PipelinePlan['sort'] = { by: 'measure', direction: 'desc' };
  let sorted = false;
  let limit: number | null = null;
  let count: string | null = null;

  stages.forEach((stage, i) => {
    const names = Object.keys(stage);
    if (names.length !== 1) fail(i, 'a stage has exactly one $operator');
    const name = names[0]!;
    const body = stage[name];
    switch (name) {
      case '$match':
        if (keys) fail(i, '$match after $group (a filter on the groups) is not supported here');
        if (!isDoc(body)) fail(i, '$match takes a filter document');
        matches.push(body as Doc);
        return;
      case '$unwind':
        if (keys) fail(i, '$unwind after $group is not supported here');
        unwound.add(field(i, isDoc(body) ? body.path : body, '$unwind'));
        return;
      case '$count':
        if (keys) fail(i, '$count after $group is not supported here');
        if (typeof body !== 'string' || !body) fail(i, '$count takes a field name');
        keys = [];
        count = body as string;
        measures = [{ alias: count, op: 'count' }];
        return;
      case '$group': {
        if (keys) fail(i, 'one $group only');
        if (!isDoc(body) || !('_id' in body)) fail(i, '$group needs an _id');
        const g = body as Doc;
        const keyOf = (name: string | null, expr: unknown): PipelineKey => {
          if (typeof expr === 'string') {
            const f = field(i, expr, '_id');
            return { name, field: f, by: unwound.has(f) ? 'each' : 'value' };
          }
          if (!isDoc(expr) || Object.keys(expr).length !== 1)
            return fail(i, `_id: ${JSON.stringify(expr)} has no grouping here`);
          const [op, arg] = Object.entries(expr)[0]!;
          if (op === '$toLower' || op === '$toUpper')
            return { name, field: field(i, arg, op), by: op === '$toLower' ? 'lower' : 'upper' };
          if (op === '$year')
            return { name, field: field(i, arg, op), by: 'year', output: { year: true } };
          // MongoDB applies timezone, binSize and startOfWeek; an option this translation cannot honor is refused
          // instead of ignored, so a result never differs silently. VERIFIED: MongoDB 9.0.8 truncates the week of
          // Wednesday 2026-11-18 to Sunday 2026-11-15 without startOfWeek; dataview's weeks start on Monday.
          const zoneOf = (o: Doc, allowed: string[]) => {
            for (const k of Object.keys(o))
              if (!allowed.includes(k)) fail(i, `${op} option '${k}' is not supported here`);
            if (o.timezone === undefined) return {};
            if (typeof o.timezone !== 'string')
              fail(i, `${op} timezone takes an IANA name such as 'Europe/Berlin'`);
            return { zone: o.timezone as string };
          };
          if (op === '$dateTrunc' && isDoc(arg)) {
            const unit = String(arg.unit);
            if (!(UNITS as readonly string[]).includes(unit))
              fail(i, `$dateTrunc unit '${unit}': one of ${UNITS.join(', ')}`);
            if (arg.binSize !== undefined && arg.binSize !== 1)
              fail(i, '$dateTrunc binSize: only 1');
            if (unit === 'week' && !/^mon(day)?$/i.test(String(arg.startOfWeek)))
              fail(
                i,
                "$dateTrunc unit 'week' needs startOfWeek: 'monday'; MongoDB's weeks otherwise start on Sunday",
              );
            return {
              name,
              field: field(i, arg.date, '$dateTrunc'),
              by: unit as GroupUnit,
              ...zoneOf(arg, ['date', 'unit', 'timezone', 'binSize', 'startOfWeek']),
            };
          }
          if (op === '$dateToString' && isDoc(arg)) {
            const zone = zoneOf(arg, ['date', 'format', 'timezone']);
            const format = String(arg.format);
            const by = FORMATS[format];
            if (!by)
              fail(
                i,
                `$dateToString format '${format}': one of ${Object.keys(FORMATS).join(', ')}`,
              );
            return {
              name,
              field: field(i, arg.date, '$dateToString'),
              by: by!,
              output: { format },
              ...zone,
            };
          }
          return fail(i, `_id: ${op} has no grouping here`);
        };
        const id = g._id;
        // a document of fields - or one operator expression ({ $toLower: '$country' })
        keys =
          id === null || id === undefined || (typeof id !== 'string' && !isDoc(id))
            ? []
            : isDoc(id) && !Object.keys(id).some((k) => k.startsWith('$'))
              ? Object.entries(id).map(([k, v]) => keyOf(k, v))
              : [keyOf(null, id)];
        for (const [alias, acc] of Object.entries(g)) {
          if (alias === '_id') continue;
          if (!isDoc(acc) || Object.keys(acc).length !== 1)
            fail(i, `${alias}: an accumulator such as { $sum: 1 }`);
          const [op, arg] = Object.entries(acc as Doc)[0]!;
          // { $sum: { $cond: [{ $gt: ['$f', null] }, 1, 0] } }: the documents that hold the field
          const cond =
            op === '$sum' && isDoc(arg) && Array.isArray(arg.$cond)
              ? (arg.$cond as unknown[])
              : null;
          const held =
            cond &&
            cond[1] === 1 &&
            cond[2] === 0 &&
            isDoc(cond[0]) &&
            Array.isArray(cond[0].$gt) &&
            cond[0].$gt[1] === null
              ? field(i, cond[0].$gt[0], '$gt')
              : null;
          const m: PipelineMeasure =
            op === '$count' || (op === '$sum' && arg === 1)
              ? { alias, op: 'count' }
              : held
                ? { alias, op: 'count', field: held }
                : op === '$sum' || op === '$avg' || op === '$min' || op === '$max'
                  ? {
                      alias,
                      op: op.slice(1) as PipelineMeasure['op'],
                      field: field(i, arg, op),
                    }
                  : op === '$addToSet'
                    ? { alias, op: 'distinct', field: field(i, arg, op) }
                    : fail(
                        i,
                        `${alias}: ${op} is not supported here (count, sum, avg, min, max, addToSet)`,
                      );
          measures.push(m);
        }
        return;
      }
      case '$set':
      case '$addFields':
      case '$project': {
        if (!isDoc(body)) fail(i, `${name} takes a document`);
        // { n: { $size: '$n' } } over an $addToSet: the number of distinct values
        for (const [alias, v] of Object.entries(body as Doc))
          if (isDoc(v) && '$size' in v) {
            const m = measures.find((x) => x.alias === alias || `$${x.alias}` === v.$size);
            if (!m || m.op !== 'distinct') fail(i, `${alias}: $size of an $addToSet only`);
            m!.op = 'countDistinct';
          }
        return;
      }
      case '$sort': {
        if (!isDoc(body) || !Object.keys(body).length) fail(i, '$sort takes { field: 1 | -1 }');
        const [key, dir] = Object.entries(body as Doc)[0]!;
        if (dir !== 1 && dir !== -1) fail(i, `$sort by '${key}' takes 1 or -1`);
        const direction = dir === -1 ? 'desc' : 'asc';
        sorted = true;
        if (key === '_id' || key.startsWith('_id.')) {
          const at = key === '_id' ? 0 : (keys ?? []).findIndex((k) => k.name === key.slice(4));
          if (at < 0) fail(i, `$sort by '${key}': no such key in the $group`);
          sort = { by: 'key', key: at, direction };
          return;
        }
        const at = measures.findIndex((m) => m.alias === key);
        if (at < 0) fail(i, `$sort by '${key}': a key (_id) or a measure of the $group`);
        measures.unshift(...measures.splice(at, 1));
        sort = { by: 'measure', direction };
        return;
      }
      case '$limit':
        if (typeof body !== 'number' || !Number.isInteger(body) || body < 1)
          fail(i, '$limit takes a whole number');
        limit = body as number;
        return;
      default:
        fail(
          i,
          `${name} is not supported here ($match, $unwind, $group, $set, $sort, $limit, $count)`,
        );
    }
  });
  if (!keys) throw new QueryError('pipeline: a $group (or $count) stage says what to measure');
  const plannedKeys = keys as PipelineKey[];
  for (const f of unwound)
    if (!plannedKeys.some((k) => k.field === f && k.by === 'each'))
      throw new QueryError(
        `$unwind '$${f}' only as a group key here (its documents counted once per element)`,
      );
  const match =
    matches.length === 0 ? null : matches.length === 1 ? matches[0]! : { $and: matches };
  return { match, keys: plannedKeys, measures, sort, sorted, limit, count };
}

type Builder = (...args: unknown[]) => unknown;

/**
 * The aggregate descriptor of a plan on a collection's builders: groupBy g0..gn, measures m0..mn, orderBy.
 */
export function aggregateDescriptor(plan: PipelinePlan, q: unknown): Doc {
  const b = q as Record<string, Builder | undefined>;
  const call = (name: string, ...args: unknown[]) => {
    const fn = b[name];
    if (typeof fn !== 'function')
      throw new QueryError(`${name}: the collection's expression builders lack it`);
    return fn.apply(q, args);
  };
  const ref = (f: string) => (f.includes('.') ? call('path', f) : call('field', f));
  const num = (f: string) => (f.includes('.') ? call('number', call('path', f)) : call('field', f));
  const key = (k: PipelineKey) => {
    const r = ref(k.field);
    if (k.by === 'value') return r;
    if (k.by === 'lower' || k.by === 'upper' || k.by === 'each') return call(k.by, r);
    return call('dateTrunc', r, k.by, k.zone ? { timeZone: k.zone } : undefined);
  };
  const measure = (m: PipelineMeasure) => {
    if (m.op === 'count') return m.field ? call('count', ref(m.field)) : call('count');
    // sums and averages read numbers; the others compare any value (text, dates)
    return m.op === 'sum' || m.op === 'avg' ? call(m.op, num(m.field!)) : call(m.op, ref(m.field!));
  };
  const { filters, where } = mongoRequest(q, plan.match ?? {});
  const orderBy =
    plan.sort.by === 'key' && plan.keys.length
      ? [{ field: `g${plan.sort.key}`, direction: plan.sort.direction }]
      : plan.measures.length
        ? [{ field: 'm0', direction: plan.sort.direction }]
        : [];
  return {
    filters,
    ...(where ? { where } : {}),
    ...(plan.keys.length
      ? { groupBy: Object.fromEntries(plan.keys.map((k, i) => [`g${i}`, key(k)])) }
      : {}),
    measures: Object.fromEntries(plan.measures.map((m, i) => [`m${i}`, measure(m)])),
    orderBy,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** The wall-clock parts of an instant in a zone; Intl, since Node.js 20 to 24 lack Temporal. */
function wallClock(v: Date, zone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  }).formatToParts(v);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return { '%Y': part('year'), '%m': part('month'), '%d': part('day'), '%H': part('hour') };
}
/** A key as MongoDB writes it: $year a number, $dateToString its text (UTC or its zone), else the value. */
function keyOutput(k: PipelineKey, v: unknown): unknown {
  if (!k.output || !(v instanceof Date)) return v;
  if ('year' in k.output) return v.getUTCFullYear();
  const parts: Record<string, string> = k.zone
    ? wallClock(v, k.zone)
    : {
        '%Y': String(v.getUTCFullYear()),
        '%m': pad(v.getUTCMonth() + 1),
        '%d': pad(v.getUTCDate()),
        '%H': pad(v.getUTCHours()),
      };
  return k.output.format.replace(/%[YmdH]/g, (p) => parts[p]!);
}

/**
 * Runs a MongoDB aggregation pipeline (stages, or their text) on a collection - also one bound with at(date) - and
 * returns MongoDB's documents: `{ _id, ...accumulators }`, or `[{ [name]: n }]` for a $count stage.
 */
export async function aggregateMongo<T = Doc>(
  collection: MongoAggregatable,
  pipeline: readonly Doc[] | string,
): Promise<T[]> {
  const plan = translatePipeline(typeof pipeline === 'string' ? parsePipeline(pipeline) : pipeline);
  const descriptor = aggregateDescriptor(plan, collection.q);
  const result = await collection.aggregate(
    descriptor,
    plan.limit ? { limit: plan.limit } : undefined,
  );
  const rows = result.rows as Doc[];
  if (plan.count !== null) {
    const n = (rows[0]?.m0 as number | undefined) ?? 0;
    return (n ? [{ [plan.count]: n }] : []) as T[];
  }
  return rows.map((r) => {
    const values = plan.keys.map((k, i) => keyOutput(k, r[`g${i}`]));
    const _id =
      plan.keys.length === 0
        ? null
        : plan.keys.length === 1 && plan.keys[0]!.name === null
          ? values[0]
          : Object.fromEntries(plan.keys.map((k, i) => [k.name, values[i]]));
    return { _id, ...Object.fromEntries(plan.measures.map((m, i) => [m.alias, r[`m${i}`]])) };
  }) as T[];
}
