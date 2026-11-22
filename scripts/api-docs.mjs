// Builds the API reference app into docs/application/ (run by `make site`, after `make build`):
// - app-api-docs.html: website/application/app-api-docs.html, defuss-shadcn's API Documentation scaffold adapted to a
//   library, with its data block - the guides (docs/API.md by section) and the reference (every member the method
//   tables of docs/API.md describe, with its signature from the type declarations in dist/);
// - js/api-docs/client.js: the page's runtime (website/application/client.mjs), defuss-db from dist/ with the sample
//   database Call it runs on;
// - api-docs/: every page as Markdown and JSON, with index.md, index.json and llms.txt, for readers that run no
//   JavaScript.
// scripts/shadcn-sync.mjs copies the component bundle, theme and fonts the page loads.
// Why not the scaffold's generator, defuss-rpc schema: VERIFIED: run over Database and Collection it typed insert() as
// returning PrimaryKey, because RPC answers are always awaited and it unwraps the Promise; it also skipped the read
// methods Collection inherits (probe 2026-11-22). TypeScript's parser prints each declaration as a user's editor shows it.
// Why the declarations and docs/API.md and not JSDoc: the declarations are what a TypeScript user's editor shows, and
// the method tables are the documented contract; the source carries JSDoc on a few members only. The build fails when
// a table names a member the declarations lack, or a public method of Database, Collection or ReadCollection has no
// row, so the reference cannot drift from either.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { Marked } from 'marked';
import ts from 'typescript';
import * as api from '../dist/index.mjs';
import * as mongo from '../dist/mongo.mjs';
import {
  ENTRIES,
  EXAMPLES,
  FIXED,
  NOT_HERE,
  exampleArgs,
  samples,
} from '../website/application/sample.mjs';

const out = 'docs/application';
const read = (path) => readFile(path, 'utf8');
const { version } = JSON.parse(await read('package.json'));

// -- the namespaces: which sections of docs/API.md describe their members, and what each is
const NAMESPACES = [
  {
    name: 'Opening',
    kind: 'module',
    sections: ['Opening'],
    description:
      'Functions that open a database: in memory or on a DBSONL backend (`defuss-db`), in a directory (`defuss-db/server`, Node.js and Bun) or in OPFS (`defuss-db/browser`, a dedicated worker). Each returns a `Database`.',
  },
  {
    name: 'Database',
    kind: 'class',
    sections: ['Database'],
    description:
      'What opening returns: typed collections, transactions across collections, snapshots, archives, statistics and maintenance.',
  },
  {
    name: 'Collection',
    kind: 'class',
    sections: ['Collection mutations', 'Collection reads'],
    description:
      'A collection of documents. `db.collection(name)` returns one without I/O; each write commits in its own transaction, and the reads are the same on snapshots and in transactions.',
  },
  {
    name: 'Mongo',
    kind: 'module',
    sections: ['MongoDB syntax and schemas'],
    description:
      '`defuss-db/mongo`: MongoDB filter, sort, projection and pipeline documents on any collection - a `Collection`, a view from `at(date)` or a `TransactionCollection`.',
  },
];

// -- links: docs/*.md pages are the site's guides; a fragment of docs/API.md is a guide of this app
const SLUGS = { 'README.md': 'readme', 'ARCH.md': 'architecture' };
const guidePage = (file) => SLUGS[file] ?? file.replace(/\.md$/, '').toLowerCase();
/** `href` from docs/API.md as seen from a page `up` folders below docs/application/. */
const linkFrom = (up, guideIds) => (href) => {
  if (/^[a-z]+:|^\/\//.test(href) || href.startsWith('#/')) return href;
  const app = '../'.repeat(up);
  if (href.startsWith('#'))
    return guideIds.has(href.slice(1))
      ? `${app}app-api-docs.html#/guides/${href.slice(1)}`
      : `${app}../guides/api.html${href}`;
  const [file, fragment] = href.split('#');
  assert.match(file, /^[\w-]+\.md$/, 'unexpected link in docs/API.md: ' + href);
  // scripts/site.mjs wrote the guides before this script runs
  assert.ok(existsSync(`docs/guides/${guidePage(file)}.html`), 'no site guide for ' + href);
  return `${app}../guides/${guidePage(file)}.html${fragment ? '#' + fragment : ''}`;
};
// in the app itself, its own routes stay hash links
const appLink = (guideIds) => (href) =>
  href.startsWith('#') && guideIds.has(href.slice(1))
    ? '#/guides/' + href.slice(1)
    : linkFrom(0, guideIds)(href);

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const markdown = (rewrite) =>
  new Marked({
    gfm: true,
    walkTokens: (token) => {
      if (token.type === 'link') token.href = rewrite(token.href);
    },
    renderer: {
      // Shiki paints every [data-lang] listing of the page
      code: ({ text, lang }) =>
        `<pre data-lang="${escapeHtml(lang || 'ts')}"><code>${escapeHtml(text)}</code></pre>\n`,
    },
  });
const plain = (md) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// -- docs/API.md: its sections, and the rows of their member tables
const apiMd = await read('docs/API.md');
const lexer = new Marked({ gfm: true });
const sections = [];
for (const token of lexer.lexer(apiMd)) {
  if (token.type === 'heading' && token.depth === 2)
    sections.push({ title: token.text, tokens: [] });
  else if (token.type !== 'heading' || token.depth > 2) sections.at(-1)?.tokens.push(token);
}
const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
for (const s of sections) s.id = slug(s.title);
const guideIds = new Set(['introduction', ...sections.map((s) => s.id)]);
const memberTable = (token) =>
  token.type === 'table' && ['Function', 'Method'].includes(token.header[0]?.text);
// `prepareFind/Select/Aggregate/View` names four members; `insert(document, options?)` one
const namesOf = (cell) =>
  [...cell.matchAll(/`([^`]+)`/g)].flatMap(([, code]) => {
    const name = code.replace(/[<(].*$/, '').trim();
    const [first, ...more] = name.split('/');
    const stem = first.replace(/[A-Z]\w*$/, '');
    return [first, ...more.map((m) => stem + m)];
  });
const rows = new Map(); // namespace -> Map(member -> description markdown)
for (const ns of NAMESPACES) {
  const members = new Map();
  for (const title of ns.sections) {
    const section = sections.find((s) => s.title === title);
    assert.ok(section, `docs/API.md has no section "${title}"`);
    for (const table of section.tokens.filter(memberTable))
      for (const row of table.rows) {
        const cells = row.map((c) => c.text);
        const description =
          ns.name === 'Opening'
            ? `From \`${cells[1].replace(/`/g, '')}\`. Arguments: ${cells[2]}.`
            : cells[1];
        for (const name of namesOf(cells[0])) members.set(name, description);
      }
  }
  assert.ok(members.size > 0, `docs/API.md describes no member of ${ns.name}`);
  rows.set(ns.name, members);
}

// -- the declarations in dist/: classes and functions as TypeScript prints them
const declarations = { classes: new Map(), functions: new Map() };
for (const file of (await readdir('dist')).filter((f) => f.endsWith('.d.mts'))) {
  const source = ts.createSourceFile(
    file,
    await read(join('dist', file)),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const node of source.statements) {
    if (ts.isClassDeclaration(node) && node.name)
      declarations.classes.set(node.name.text, { node, source });
    if (ts.isFunctionDeclaration(node) && node.name) {
      const list = declarations.functions.get(node.name.text) ?? [];
      declarations.functions.set(node.name.text, [...list, { node, source }]);
    }
  }
}
// rollup renames clashing types (Doc$1); the reader knows them by their names
const clean = (text) => text.replace(/\b([A-Za-z_]\w*)\$\d+\b/g, '$1');
const printed = ({ node, source }) => {
  const indent = source.getLineAndCharacterOfPosition(node.getStart(source)).character;
  const [first, ...rest] = node.getText(source).split('\n');
  const text = [
    first,
    ...rest.map((line) => line.slice(Math.min(indent, line.search(/\S|$/)))),
  ].join('\n');
  return clean(
    text
      .replace(/^declare function /, '')
      .replace(/^readonly /, '')
      .replace(/;$/, ''),
  );
};
const isPublic = (member) =>
  !(
    ts.getCombinedModifierFlags(member) &
    (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)
  ) &&
  member.name &&
  !ts.isComputedPropertyName(member.name);
const membersOf = (className) => {
  const { node, source } = declarations.classes.get(className) ?? {};
  assert.ok(node, `dist/ declares no class ${className}`);
  const members = new Map();
  for (const member of node.members.filter(isPublic)) {
    if (ts.isConstructorDeclaration(member)) continue;
    const name = member.name.getText(source);
    members.set(name, [...(members.get(name) ?? []), { node: member, source }]);
  }
  return members;
};
const typeText = (node, source) => (node ? clean(node.getText(source)) : 'void');
// what a form edits: text, a number, a choice, a date - else a Property Tree (the page's fieldKind reads this)
const schemaOf = (type) => {
  const parts = type
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p && p !== 'undefined');
  if (parts.length && parts.every((p) => /^'[^']*'$/.test(p)))
    return { enum: parts.map((p) => p.slice(1, -1)) };
  if (parts.length && parts.every((p) => p === 'string' || p === 'number' || p === 'PrimaryKey'))
    return { type: parts.includes('number') && parts.length === 1 ? 'number' : 'string' };
  if (parts.length === 1 && parts[0] === 'boolean') return { type: 'boolean' };
  if (parts.length === 1 && parts[0] === 'Date') return { type: 'string', 'x-dson': 'date' };
  return {};
};
// the signature shows every overload; the parameters and the form follow the first, the common call
const docOf = (overloads, description, rewrite) => {
  const { node, source } = overloads[0];
  const property = ts.isPropertyDeclaration(node) || ts.isGetAccessorDeclaration(node);
  const returns = typeText(node.type, source);
  return {
    kind: property ? 'property' : 'method',
    async: returns.startsWith('Promise<'),
    generator: /^Async(Generator|Iterable)</.test(returns),
    signature: overloads.map(printed).join('\n'),
    description: plain(description),
    descriptionHtml: markdown(rewrite).parseInline(description),
    params: property
      ? []
      : node.parameters.map((p) => {
          const type = typeText(p.type, source);
          return {
            name: p.name.getText(source),
            type,
            optional: !!p.questionToken || !!p.initializer,
            rest: !!p.dotDotDotToken,
            schema: schemaOf(type),
          };
        }),
    returns: { type: returns },
  };
};

const appRewrite = appLink(guideIds);
const classMembers = {
  Database: membersOf('Database'),
  Collection: new Map([...membersOf('ReadCollection'), ...membersOf('Collection')]),
};
const reference = NAMESPACES.map((ns) => {
  const methods = {};
  for (const [name, description] of rows.get(ns.name)) {
    const overloads =
      ns.kind === 'class' ? classMembers[ns.name].get(name) : declarations.functions.get(name);
    assert.ok(overloads, `docs/API.md describes ${ns.name}.${name}, which dist/ does not declare`);
    methods[name] = docOf(overloads, description, appRewrite);
  }
  if (ns.kind === 'class')
    for (const [name, overloads] of classMembers[ns.name])
      if (overloads.some(({ node }) => ts.isMethodDeclaration(node)))
        assert.ok(
          name in methods,
          `${ns.name}.${name} is public but docs/API.md has no row for it`,
        );
  return {
    name: ns.name,
    kind: ns.kind,
    description: plain(ns.description),
    descriptionHtml: markdown(appRewrite).parseInline(ns.description),
    methods,
  };
});
const known = new Set(
  reference.flatMap((ns) => Object.keys(ns.methods).map((m) => ns.name + '.' + m)),
);
for (const [what, table] of Object.entries({ EXAMPLES, FIXED, NOT_HERE }))
  for (const key of Object.keys(table))
    assert.ok(
      known.has(key),
      `website/application/sample.mjs ${what} names ${key}, which the reference lacks`,
    );
for (const m of Object.values(ENTRIES).flat())
  assert.ok(known.has('Opening.' + m), `ENTRIES names ${m}, which Opening lacks`);

// -- the guides: an introduction, then each section of docs/API.md; a member table becomes a link to its namespace
const quickStart = (await read('website/examples/orders.memory.ts')).trimEnd();
const introduction = {
  id: 'introduction',
  title: 'Introduction',
  lead: 'defuss-db is a document database that runs inside your application - in a browser worker, Node.js or Bun - with the same API in each.',
  md: [
    'Open a database, take a collection, then write and read. Each write commits in its own transaction unless you pass one, and a read sees one snapshot.',
    '```ts\n' + quickStart + '\n```',
    '## How this reference works',
    'The reference lists every documented function and method. Its signatures come from the type declarations the package ships, its descriptions from the [API guide](API.md). **Call it** runs a member on a sample database in this page - six orders with history, an ordered index and a search index - and the sample code beside the form follows your arguments. **Reset** starts the sample over.',
    'Every page is also Markdown and JSON, linked under its title, and `api-docs/llms.txt` lists them all.',
  ].join('\n\n'),
};
const namespaceOf = (title) => NAMESPACES.find((ns) => ns.sections.includes(title));
const guides = [
  introduction,
  ...sections.map((s) => ({
    id: s.id,
    title: s.title,
    lead: '',
    md: s.tokens
      .map((t) =>
        memberTable(t)
          ? `The members are in the reference: [${namespaceOf(s.title).name}](#/ref/${namespaceOf(s.title).name}).\n\n`
          : t.raw,
      )
      .join('')
      .trim(),
  })),
];

// -- the words of the frame (English; the scaffold's German is not carried over)
const WORDS = {
  guides: 'Guides',
  guidesGroup: 'Guides',
  prev: 'Previous',
  next: 'Next',
  copied: 'Copied to the clipboard',
  copyHint: 'Selected - press ⌘C to copy',
  results: '%n results in %t ms - defuss-search, BM25',
  resultsMeaning: '%n results in %t ms - defuss-search, BM25 + ColBERT',
  'meaning-loading': 'Keywords now - search by meaning loads in the background (4.6 MB)',
  'meaning-semantic': 'Keywords and meaning - BM25 fused with the Winzling-reranker ColBERT model',
  'meaning-failed': 'Search by meaning did not load - keywords only',
  'meaning-saver': 'Data saver on - keywords only',
  rpcGroup: 'Reference',
  rpcOverview: 'Overview',
  rpcTitle: 'Reference',
  rpcLead: 'Every documented function and method of defuss-db, grouped by what you call it on.',
  rpcBody: [
    'Each signature comes from the type declarations the package ships, each description from the API guide. A member that returns a Promise is tagged ASYNC, an async generator STREAM, one that returns at once SYNC, and a property PROP.',
    '> Call it runs a member on the sample database in this page. Reset starts the sample over.',
  ],
  methods: '%n members',
  'tag-ASYNC': 'Returns a Promise',
  'tag-STREAM': 'An async generator',
  'tag-SYNC': 'Returns at once',
  'tag-PROP': 'A property',
  deprecated: 'Deprecated',
  params: 'Parameters',
  noParams: 'This member takes no parameters.',
  returns: 'Returns',
  yields: 'Yields',
  throws: 'Throws',
  examples: 'Examples',
  optional: 'optional',
  required: 'required',
  asMarkdown: 'Markdown',
  asJson: 'JSON',
  pageAs: 'This page as',
  inPage: 'in this page',
  ms: '%t ms',
  loading: 'Loading the search index...',
  plain: 'The search index is not loaded - matching names',
  answerEmpty: 'Send the call to see its answer.',
  undefinedAnswer: 'Returned undefined.',
  returned: 'returned',
  threw: 'threw',
  noRuntime: 'The runtime of this page did not load, so Call it is off.',
};

// -- the page
const data = {
  words: WORDS,
  guides: guides.map((g) => {
    const html = markdown(appRewrite).parse(g.md);
    return {
      id: g.id,
      title: g.title,
      lead: g.lead,
      html,
      text: plain(g.md.replace(/```[\s\S]*?```/g, '')),
    };
  }),
  reference,
};
await rm(join(out, 'app-api-docs.html'), { force: true });
await rm(join(out, 'js'), { recursive: true, force: true });
await rm(join(out, 'api-docs'), { recursive: true, force: true });
await mkdir(out, { recursive: true });
const page = (await read('website/application/app-api-docs.html'))
  .replace('@@API_DATA@@', () => JSON.stringify(data).replaceAll('<', '\\u003c'))
  .replaceAll('@@VERSION@@', version);
assert.doesNotMatch(page, /@@[A-Z_]+@@/, 'app-api-docs.html keeps an unexpanded token');
await writeFile(join(out, 'app-api-docs.html'), page);

// -- the runtime: defuss-db and the sample, one module and the chunks it loads on demand
await build({
  entryPoints: { client: 'website/application/client.mjs' },
  outdir: join(out, 'js/api-docs'),
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  minify: true,
  // the answer names the library's objects by their class: Database, Collection
  keepNames: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
  logOverride: { 'ignored-bare-import': 'silent' },
});

// -- every page as Markdown and JSON
const files = new Map();
const fence = (lang, body) => '```' + lang + '\n' + body + '\n```';
const cell = (text) => (text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (text) => '`' + text.replace(/`/g, "'") + '`';
const pages = [];
const add = (path, route, title, kind, md, json) => {
  const up = path.split('/').length; // folders below docs/application/
  const app = '../'.repeat(up) + 'app-api-docs.html';
  pages.push({ path, route, title, kind, signature: json.signature });
  files.set(
    path + '.md',
    md.replaceAll('](@app', '](' + app) +
      `\n\nInteractive: [${title} in the app](${app}${route}).\n`,
  );
  files.set(
    path + '.json',
    JSON.stringify(
      { kind, route, title, ...json, markdown: path.split('/').pop() + '.md' },
      null,
      2,
    ) + '\n',
  );
};
const context = { q: api.forRows(), mongo };
for (const g of guides) {
  const route = g.id === 'introduction' ? '#/' : '#/guides/' + g.id;
  const path = 'guides/' + g.id;
  // the links of the Markdown, rewritten for its folder
  const rewrite = linkFrom(2, guideIds);
  const body = g.md.replace(/\]\(([^)\s]+)\)/g, (_m, href) =>
    href.startsWith('#/') ? `](@app${href})` : `](${rewrite(href)})`,
  );
  add(
    path,
    route,
    g.title,
    'guide',
    [`# ${g.title}`, '', ...(g.lead ? [g.lead, ''] : []), body].join('\n'),
    {
      id: g.id,
      lead: g.lead,
    },
  );
}
add(
  'ref/index',
  '#/ref',
  WORDS.rpcTitle,
  'reference',
  [
    '# defuss-db reference',
    '',
    WORDS.rpcLead,
    '',
    '| Namespace | Kind | Members | Description |',
    '| --- | --- | --- | --- |',
    ...reference.map(
      (ns) =>
        `| [${ns.name}](${ns.name}.md) | ${ns.kind} | ${Object.keys(ns.methods).length} | ${cell(ns.description)} |`,
    ),
  ].join('\n'),
  { namespaces: reference.map((ns) => ns.name), version },
);
for (const ns of reference) {
  const members = Object.entries(ns.methods);
  add(
    'ref/' + ns.name,
    '#/ref/' + ns.name,
    ns.name,
    'namespace',
    [
      `# ${ns.name}`,
      '',
      ns.description,
      '',
      '| Member | Signature | Description |',
      '| --- | --- | --- |',
      ...members.map(
        ([m, doc]) =>
          `| [${m}](${ns.name}/${m}.md) | ${cell(code(doc.signature.split('\n')[0]))} | ${cell(doc.description)} |`,
      ),
    ].join('\n'),
    { namespaceKind: ns.kind, description: ns.description, members: members.map(([m]) => m) },
  );
  for (const [m, doc] of members) {
    const title = ns.kind === 'class' ? `${ns.name}.${m}` : m;
    const args = exampleArgs(ns.name, m, doc, context);
    add(
      `ref/${ns.name}/${m}`,
      `#/ref/${ns.name}/${m}`,
      title,
      'member',
      [
        `# ${title}`,
        '',
        fence('ts', doc.signature),
        '',
        doc.description,
        '',
        ...(doc.params.length
          ? [
              '## Parameters',
              '',
              '| Name | Type | Required |',
              '| --- | --- | --- |',
              ...doc.params.map(
                (p) =>
                  `| ${code((p.rest ? '...' : '') + p.name)} | ${cell(code(p.type))} | ${p.optional ? 'no' : 'yes'} |`,
              ),
              '',
            ]
          : []),
        '## Returns',
        '',
        code(doc.returns.type),
        '',
        '## Call it',
        '',
        ...(NOT_HERE[ns.name + '.' + m] ? [NOT_HERE[ns.name + '.' + m], ''] : []),
        fence('ts', samples(ns.name, m, doc, args).ts),
      ].join('\n'),
      {
        namespace: ns.name,
        name: m,
        signature: doc.signature,
        description: doc.description,
        kind: doc.kind,
        async: doc.async,
        generator: doc.generator,
        params: doc.params.map(({ name, type, optional, rest }) => ({
          name,
          type,
          optional,
          rest,
        })),
        returns: doc.returns,
      },
    );
  }
}
const entry = (p) =>
  `- [${p.title}](${p.path}.md)${p.signature ? ' - ' + code(p.signature.split('\n')[0]) : ''}`;
const listing = [
  '## Guides',
  '',
  ...pages.filter((p) => p.kind === 'guide').map(entry),
  '',
  '## Reference',
  '',
  ...pages.filter((p) => p.kind !== 'guide').map(entry),
  '',
];
files.set(
  'index.md',
  [
    '# defuss-db API reference',
    '',
    `Every page of the API reference app for defuss-db ${version} as Markdown, with JSON beside it.`,
    '',
    ...listing,
  ].join('\n'),
);
files.set(
  'index.json',
  JSON.stringify(
    pages.map((p) => ({
      path: p.path,
      route: p.route,
      title: p.title,
      kind: p.kind,
      markdown: p.path + '.md',
      json: p.path + '.json',
    })),
    null,
    2,
  ) + '\n',
);
files.set(
  'llms.txt',
  [
    '# defuss-db API',
    '',
    `> The API reference of defuss-db ${version}, a document database for the browser, Node.js and Bun: guides, then every documented function and method with its signature. Each link is a Markdown page; the same path with .json is its data.`,
    '',
    ...listing,
  ].join('\n'),
);
for (const [path, content] of files) {
  await mkdir(join(out, 'api-docs', path, '..'), { recursive: true });
  await writeFile(join(out, 'api-docs', path), content);
}
console.log(
  `${new Date().toISOString()} INFO built the API reference dir=${out} guides=${guides.length} members=${known.size} pages=${pages.length}`,
);
