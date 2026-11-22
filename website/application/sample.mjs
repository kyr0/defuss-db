// The sample behind the API reference's Call it, shared by the page's runtime (client.mjs) and the generator
// (scripts/api-docs.mjs): the sample database, the arguments every member starts with, the arguments the page fills in
// itself, why a member cannot run in the page, and the TypeScript each call shows.
// Why examples by hand and not from the types: a value a type allows is rarely a call anyone makes, and a filter on a
// field the sample lacks returns nothing. scripts/e2e-site.mjs sends every example and fails on an error.

const day = (d, h = 9) => new Date(Date.UTC(2026, 10, d, h, 30));

/**
 * The sample orders, each written at the time it was placed: the collection tracks history. Totals are numbers:
 * VERIFIED: q.sum() over BigInt totals throws "sum/avg operand must be a finite number or null" (probe 2026-11-22).
 */
export const ORDERS = [
  {
    id: 'o-1001',
    customer: 'ada',
    total: 120,
    placedAt: day(2),
    status: 'paid',
    items: [{ sku: 'kb-01', qty: 1 }],
    note: 'Gift wrap, please',
  },
  {
    id: 'o-1002',
    customer: 'grace',
    total: 45,
    placedAt: day(4),
    status: 'open',
    items: [{ sku: 'ms-02', qty: 1 }],
    note: 'Leave it at the door',
  },
  {
    id: 'o-1003',
    customer: 'ada',
    total: 80,
    placedAt: day(9),
    status: 'paid',
    items: [
      { sku: 'ms-02', qty: 1 },
      { sku: 'pd-03', qty: 2 },
    ],
    note: 'A second mouse for the office',
  },
  {
    id: 'o-1004',
    customer: 'alan',
    total: 230,
    placedAt: day(12),
    status: 'paid',
    items: [{ sku: 'mn-04', qty: 1 }],
    note: 'Monitor arm included',
  },
  {
    id: 'o-1005',
    customer: 'grace',
    total: 18,
    placedAt: day(15),
    status: 'open',
    items: [{ sku: 'pd-03', qty: 1 }],
    note: 'Express delivery',
  },
  {
    id: 'o-1006',
    customer: 'ada',
    total: 64,
    placedAt: day(18),
    status: 'open',
    items: [{ sku: 'kb-01', qty: 1 }],
    note: 'Gift wrap again',
  },
];
export const CUSTOMERS = [
  { id: 'ada', name: 'Ada Lovelace', city: 'London' },
  { id: 'alan', name: 'Alan Turing', city: 'Manchester' },
  { id: 'grace', name: 'Grace Hopper', city: 'New York' },
];

/**
 * Opens the sample database with `api` (defuss-db's main entry): orders with history, an ordered index and a search
 * index, and customers. The first order was paid a day after it was placed, so its history has two segments.
 */
export async function openSample(api) {
  const db = await api.openMemory({ name: 'sample' });
  const orders = await db.ensureCollection('orders', { $trackHistory: true });
  await orders.createIndex({
    name: 'byCustomer',
    fields: ['customer', 'placedAt'],
    order: ['asc', 'desc'],
  });
  await orders.createSearchIndex({
    name: 'notes',
    kind: 'lexical',
    text: { fields: { note: { path: 'note', analyzer: 'en' } } },
  });
  for (const order of ORDERS)
    await orders
      .at(order.placedAt)
      .put(order.id === 'o-1001' ? { ...order, status: 'open' } : order);
  await orders.at(day(3)).put(ORDERS[0]);
  await db.collection('customers').insertMany(CUSTOMERS);
  return { db, orders };
}

const filter = (field, op, value) => ({ field, op, value });

/**
 * The arguments a member starts with, by `Namespace.member`. `q` builds expressions (forRows' builders, plain data);
 * `mongo` is defuss-db/mongo. A member that is not listed starts from its parameters' types.
 */
export const EXAMPLES = {
  'Opening.openMemory': () => [{ name: 'scratch' }],
  'Opening.openDirectory': () => ['./data'],
  'Opening.openOPFS': () => [{ namespace: 'shop' }],
  'Database.collection': () => ['orders'],
  'Database.ensureCollection': () => ['refunds', { $timestamps: true }],
  'Collection.at': () => [day(10)],
  'Collection.history': () => ['o-1001'],
  'Collection.audit': () => ['o-1001'],
  'Collection.get': () => ['o-1001'],
  'Collection.getMany': () => [['o-1001', 'o-1003', 'o-9999']],
  'Collection.has': () => ['o-1002'],
  'Collection.find': () => [
    {
      filters: [filter('customer', 'eq', 'ada')],
      sorters: [{ field: 'placedAt', direction: 'desc' }],
    },
  ],
  'Collection.findOne': () => [{ filters: [filter('status', 'eq', 'open')] }],
  'Collection.query': () => [{ filters: [filter('total', 'gte', 50)], limit: 2 }],
  'Collection.count': () => [{ filters: [filter('status', 'eq', 'paid')] }],
  'Collection.stream': () => [{ filters: [filter('customer', 'eq', 'grace')] }],
  'Collection.select': ({ q }) => [
    {
      select: { customer: q.field('customer'), total: q.field('total') },
      filters: [filter('status', 'eq', 'open')],
    },
  ],
  'Collection.aggregate': ({ q }) => [
    {
      groupBy: { customer: q.field('customer') },
      measures: { orders: q.count(), revenue: q.sum(q.field('total')) },
    },
  ],
  'Collection.view': ({ q }) => [
    {
      select: { customer: q.field('customer'), total: q.field('total') },
      totals: { revenue: q.sum(q.field('total')) },
    },
  ],
  'Collection.explain': () => [{ filters: [filter('customer', 'eq', 'ada')] }],
  'Collection.search': () => ['notes', { text: 'gift wrap' }],
  'Collection.pageByIndex': () => ['byCustomer', { prefix: ['ada'], limit: 2 }],
  'Collection.pageIdsByIndex': () => ['byCustomer', { prefix: ['ada'], limit: 2 }],
  'Collection.countByIndex': () => ['byCustomer', { prefix: ['ada'] }],
  'Collection.insert': () => [
    {
      id: 'o-1007',
      customer: 'lin',
      total: 39,
      placedAt: day(20),
      status: 'open',
      items: [{ sku: 'ms-02', qty: 1 }],
      note: 'First order',
    },
  ],
  'Collection.insertMany': () => [
    [
      {
        id: 'o-1008',
        customer: 'lin',
        total: 12,
        placedAt: day(21),
        status: 'open',
        items: [{ sku: 'pd-03', qty: 1 }],
        note: '',
      },
      {
        id: 'o-1009',
        customer: 'alan',
        total: 99,
        placedAt: day(21),
        status: 'paid',
        items: [{ sku: 'kb-01', qty: 1 }],
        note: 'Spare keyboard',
      },
    ],
  ],
  'Collection.put': () => [{ ...ORDERS[1], status: 'paid' }],
  'Collection.update': () => ['o-1002', { status: 'paid' }],
  'Collection.delete': () => ['o-1005'],
  'Collection.restore': () => ['o-1005'],
  'Collection.updateMany': () => [
    { filters: [filter('status', 'eq', 'open')] },
    { status: 'paid' },
  ],
  'Collection.deleteMany': () => [{ filters: [filter('customer', 'eq', 'grace')] }],
  'Collection.createIndex': () => [{ name: 'byStatus', fields: ['status'] }],
  'Collection.createSearchIndex': () => [
    { name: 'customers', kind: 'lexical', text: { fields: { customer: { path: 'customer' } } } },
  ],
  'Collection.dropSearchIndex': () => ['notes'],
  'Collection.dropIndex': () => ['byCustomer'],
  'Mongo.findMongo': () => [
    undefined,
    { customer: 'ada', total: { $gte: 70 } },
    { sort: { placedAt: -1 } },
  ],
  'Mongo.aggregateMongo': () => [
    undefined,
    [
      { $match: { status: 'paid' } },
      { $group: { _id: '$customer', revenue: { $sum: '$total' } } },
      { $sort: { revenue: -1 } },
    ],
  ],
  'Mongo.mongoRequest': () => [undefined, { customer: 'ada' }, { placedAt: -1 }],
  'Mongo.translatePipeline': () => [
    [{ $match: { status: 'paid' } }, { $group: { _id: '$customer', revenue: { $sum: '$total' } } }],
  ],
  'Mongo.aggregateDescriptor': ({ mongo }) => [
    mongo.translatePipeline([
      { $match: { status: 'paid' } },
      { $group: { _id: '$customer', revenue: { $sum: '$total' } } },
    ]),
  ],
  'Mongo.parseDocument': () => [
    '{ placedAt: ISODate("2026-11-02T09:30:00Z"), total: NumberLong(120) }',
  ],
  'Mongo.parsePipeline': () => ['[{ $match: { status: "paid" } }, { $count: "paid" }]'],
  'Mongo.stringify': () => [{ id: 'o-1001', total: 120n, placedAt: day(2) }],
  'Mongo.revive': () => [
    { placedAt: { $date: '2026-11-02T09:30:00Z' }, total: { $numberLong: '120' } },
  ],
  'Mongo.translateFilter': () => [{ customer: 'ada', 'items.sku': 'kb-01' }],
  'Mongo.translateSort': () => [{ placedAt: -1, id: 1 }],
  'Mongo.project': () => [
    { id: 'o-1001', customer: 'ada', total: 120, note: 'Gift wrap, please' },
    { customer: 1, total: 1 },
  ],
};

/** The arguments the page passes itself, by index, with the name the sample code gives them. */
export const FIXED = {
  'Mongo.findMongo': { 0: 'orders' },
  'Mongo.aggregateMongo': { 0: 'orders' },
  'Mongo.mongoRequest': { 0: 'orders.q' },
  'Mongo.translateFilter': { 1: 'orders.q' },
  'Mongo.aggregateDescriptor': { 1: 'orders.q' },
};

/** Why a member does not run in the page; its sample shows the call. */
export const NOT_HERE = {
  'Opening.openDatabase':
    'Takes a DBSONL backend, which a form cannot build - the sample passes one.',
  'Opening.openDirectory':
    'Opens a directory on disk, so it runs in Node.js and Bun - not in this page.',
  'Opening.openOPFS':
    'Runs in a dedicated browser worker - this page keeps its sample database in memory.',
  'Database.transaction': 'Takes a callback, which a form cannot build - the sample passes one.',
  'Database.import': 'Takes the bytes of an archive - the sample imports what export() wrote.',
  'Collection.insertBatches':
    'Takes an iterable of batches, which a form cannot build - the sample passes one.',
  'Collection.prepareFind': 'Returns a plan whose methods run later - the sample runs it.',
  'Collection.prepareSelect': 'Returns a plan whose methods run later - the sample runs it.',
  'Collection.prepareAggregate': 'Returns a plan whose methods run later - the sample runs it.',
  'Collection.prepareView': 'Returns a plan whose methods run later - the sample runs it.',
  'Collection.source':
    'Returns a DataView record source for other DataView code - the sample reads it.',
  'Collection.q': 'A property: the builders of the expressions that descriptors hold.',
};

/** The TypeScript of the members that do not run in the page, after the lines that open the sample. */
const CODE = {
  'Opening.openDatabase': `import { createMemoryBackend, openDatabase } from 'defuss-db';\n\nconst db = await openDatabase(createMemoryBackend(), { name: 'scratch' });`,
  'Database.transaction': `const { result, revision } = await db.transaction(async (tx) => {\n  await tx.collection('orders').update('o-1002', { status: 'paid' });\n  await tx.collection('customers').update('grace', { lastOrder: 'o-1002' });\n  return 'paid';\n});`,
  'Database.import': `const bytes = await db.export();\nconst copy = await openMemory({ name: 'copy' });\nconst receipt = await copy.import(bytes);`,
  'Collection.insertBatches': `async function* batches() {\n  yield [{ id: 'o-2001', customer: 'lin', total: 30, placedAt: new Date(), status: 'open', items: [], note: '' }];\n  yield [{ id: 'o-2002', customer: 'lin', total: 12, placedAt: new Date(), status: 'open', items: [], note: '' }];\n}\nfor await (const receipt of orders.insertBatches(batches())) console.log(receipt.ids, receipt.revision);`,
  'Collection.prepareFind': `const plan = orders.prepareFind({ filters: [{ field: 'customer', op: 'eq', value: 'ada' }] });\nconst result = await plan.evaluate();\nconsole.log(plan.explain());`,
  'Collection.prepareSelect': `const q = orders.q;\nconst plan = orders.prepareSelect({ select: { customer: q.field('customer'), total: q.field('total') } });\nconst result = await plan.evaluate({ limit: 10 });`,
  'Collection.prepareAggregate': `const q = orders.q;\nconst plan = orders.prepareAggregate({\n  groupBy: { customer: q.field('customer') },\n  measures: { revenue: q.sum(q.field('total')) },\n});\nconst result = await plan.evaluate();`,
  'Collection.prepareView': `const q = orders.q;\nconst plan = orders.prepareView({\n  select: { customer: q.field('customer'), total: q.field('total') },\n  totals: { revenue: q.sum(q.field('total')) },\n});\nconst result = await plan.evaluate({ limit: 10 });`,
  'Collection.source': `const source = orders.source();\n// a DataView RecordSource: hand it to defuss-dataview's compute functions`,
  'Collection.q': `const q = orders.q;\nconst result = await orders.aggregate({\n  groupBy: { customer: q.field('customer') },\n  measures: { revenue: q.sum(q.field('total')) },\n});`,
};

/** The entry each function comes from. */
export const ENTRIES = {
  'defuss-db': ['openMemory', 'openDatabase'],
  'defuss-db/server': ['openDirectory'],
  'defuss-db/browser': ['openOPFS'],
};

// -- values as TypeScript source

const IDENT = /^[A-Za-z_$][\w$]*$/;
const quote = (text) =>
  "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
// q's expressions are plain data ({ v: 1, op, ... }); the common ones print as the builder call that made them
const EXPR = {
  field: (e) => `q.field(${quote(e.key)})`,
  count: () => 'q.count()',
  sum: (e, print) => `q.sum(${print(e.arg)})`,
  avg: (e, print) => `q.avg(${print(e.arg)})`,
  min: (e, print) => `q.min(${print(e.arg)})`,
  max: (e, print) => `q.max(${print(e.arg)})`,
};
const isExpr = (v) => v && typeof v === 'object' && v.v === 1 && typeof v.op === 'string';

/** A value as TypeScript source: Dates, BigInts, Maps, Sets and q's expressions as their constructors. */
export function literal(value, indent = '') {
  const inner = indent + '  ';
  const print = (v) => literal(v, inner);
  if (value === undefined) return 'undefined';
  if (value === null || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (typeof value === 'bigint') return value + 'n';
  if (typeof value === 'string') return quote(value);
  if (value instanceof Date) return `new Date(${quote(value.toISOString())})`;
  if (value instanceof Uint8Array) return `new Uint8Array(${value.length})`;
  if (value instanceof Map) return `new Map(${print([...value])})`;
  if (value instanceof Set) return `new Set(${print([...value])})`;
  if (isExpr(value) && EXPR[value.op]) return EXPR[value.op](value, print);
  const parts = Array.isArray(value)
    ? value.map(print)
    : Object.entries(value).map(([k, v]) => `${IDENT.test(k) ? k : quote(k)}: ${print(v)}`);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{ ', ' }'];
  if (!parts.length) return Array.isArray(value) ? '[]' : '{}';
  const flat = open + parts.join(', ') + close;
  if (flat.length + indent.length <= 72 && !flat.includes('\n')) return flat;
  return (
    open.trim() + '\n' + parts.map((p) => inner + p).join(',\n') + ',\n' + indent + close.trim()
  );
}
const usesQ = (value) =>
  isExpr(value) || (value && typeof value === 'object' && Object.values(value).some(usesQ));

/**
 * The TypeScript of a call: the lines that open the sample, then the member with `args`.
 * `doc` is the member's reference entry (its kind and whether it returns a Promise or streams).
 */
export function samples(ns, m, doc, args) {
  const key = ns + '.' + m;
  const fixed = FIXED[key] ?? {};
  const entry = Object.keys(ENTRIES).find((e) => ENTRIES[e].includes(m));
  const open = `import { openMemory } from 'defuss-db';\n\nconst db = await openMemory();\nconst orders = db.collection('orders');`;
  if (ns === 'Opening' && CODE[key]) return { ts: CODE[key] };
  const list = args.map((a, i) => (i in fixed ? fixed[i] : literal(a))).join(', ');
  const call = (target) => `${target}(${list})`;
  let body;
  if (CODE[key]) body = CODE[key];
  else if (doc.kind === 'property')
    body = `const value = ${ns === 'Database' ? 'db' : 'orders'}.${m};`;
  else {
    const target = ns === 'Database' ? 'db.' + m : ns === 'Collection' ? 'orders.' + m : m;
    const q = args.some(usesQ) ? 'const q = orders.q;\n' : '';
    body = doc.generator
      ? `${q}for await (const value of ${call(target)}) console.log(value);`
      : `${q}const result = ${doc.async ? 'await ' : ''}${call(target)};`;
  }
  if (ns === 'Opening')
    return {
      ts: `import { ${m} } from '${entry}';\n\n${doc.generator ? body : body.replace('const result', 'const db')}`,
    };
  if (ns === 'Mongo')
    // a function that reads no collection needs no database
    return {
      ts: Object.keys(fixed).length
        ? `import { openMemory } from 'defuss-db';\nimport { ${m} } from 'defuss-db/mongo';\n\nconst db = await openMemory();\nconst orders = db.collection('orders');\n${body}`
        : `import { ${m} } from 'defuss-db/mongo';\n\n${body}`,
    };
  return { ts: open + '\n' + body };
}

/** A value for a parameter, from its schema: what a form starts from when a member has no example. */
export function exampleValue(schema, name = 'value') {
  if (!schema) return null;
  if ('const' in schema) return schema.const;
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (Array.isArray(schema.anyOf)) return exampleValue(schema.anyOf[0], name);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (schema['x-dson'] === 'date') return '2026-11-10T09:30:00.000Z';
  if (type === 'string')
    return { id: 'o-1001', name: 'orders', collection: 'orders', index: 'byCustomer' }[name] ?? '';
  if (type === 'number' || type === 'integer') return 1;
  if (type === 'boolean') return true;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return null;
}

/** A member's starting arguments: its example, else one value per required parameter. */
export function exampleArgs(ns, m, doc, context) {
  const example = EXAMPLES[ns + '.' + m];
  if (example) return example(context);
  const params = doc.params ?? [];
  let last = params.length;
  while (last > 0 && params[last - 1].optional) last--;
  return params.slice(0, last).map((p) => exampleValue(p.schema, p.name));
}
