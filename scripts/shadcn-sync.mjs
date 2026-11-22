// Copies two apps that defuss-shadcn builds into the site, read from that repository's current commit:
// - docs/database-explorer/: the Database Explorer, which the landing page embeds. Its files are copied unchanged,
//   except for the URLs that index.html and docs-theme.css load: they point into this folder, and the three modules
//   the upstream page names on jsDelivr and unpkg come from this repository's devDependencies, so the page loads
//   nothing from another origin.
// - docs/application/: the component bundle, theme and fonts of the API Documentation app, unchanged and at the paths
//   their relative URLs expect. Its page is adapted by hand in website/application/app-api-docs.html; the script
//   warns when the upstream page differs from the one that adaptation names.
// Usage: node scripts/shadcn-sync.mjs [path to defuss-shadcn] (default ../defuss-shadcn).
// Why a copy and not a build here: the pages, styles and the explorer's database worker come from defuss-shadcn's own
// build, which this repository does not have. Why the commit and not dist/ on disk: their build rewrites dist/ in
// place, and folders vanish while it runs (VERIFIED 2026-11-22); a commit's files never change.
// VERIFIED: on 2026-11-22 defuss-shadcn's copies of defuss-dom-router 0.1.1 and defuss-i18n 0.2.0 equal the npm
// packages installed here, and its js/db bundle carries the published defuss-db 3.1.0.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const shadcn = resolve(process.argv[2] ?? '../defuss-shadcn');
const git = (...args) =>
  execFileSync('git', ['-C', shadcn, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const commit = git('rev-parse', 'HEAD');
const blob = (path) =>
  execFileSync('git', ['-C', shadcn, 'show', `${commit}:${path}`], { maxBuffer: 1 << 26 });
const text = (path) => blob(path).toString('utf8');
const list = (dir) =>
  git('ls-tree', '--name-only', commit, dir + '/')
    .split('\n')
    .map((path) => path.slice(dir.length + 1));
const read = (path) => readFile(path, 'utf8');
const version = async (dir) => JSON.parse(await read(join(dir, 'package.json'))).version;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Replaces every match of `pattern` and fails when there is none, so a changed upstream page stops the copy. */
const rewrite = (content, pattern, replace, what) => {
  assert.match(content, pattern, `${what}: no match for ${pattern}; the upstream page changed`);
  return content.replace(pattern, replace);
};
/** The fonts docs-theme.css names, relative to its css/ folder. */
const fontsOf = (theme) => {
  const fonts = [...theme.matchAll(/url\('\.\.\/fonts\/([\w.-]+\.woff2)'\)/g)].map((m) => m[1]);
  assert.ok(fonts.length > 0, 'docs-theme.css names its fonts');
  return fonts;
};

// -- the Database Explorer
let page = text('dist/documentation/application/app-db-explorer.html');
page = rewrite(page, /\.\.\/\.\.\/apps\/db-explorer\//g, '', 'app bundle');
page = rewrite(page, /\.\.\/css\/docs-theme\.css/g, 'docs-theme.css', 'docs theme');
page = rewrite(page, /'\.\.\/js\/db\/db\.js'/g, "'./js/db/db.js'", 'database module');
const modules = new Map();
page = rewrite(
  page,
  /https:\/\/cdn\.jsdelivr\.net\/npm\/(defuss-dom-router|defuss-i18n)@([\d.]+)\/dist\/([\w.]+\.js)/g,
  (_, name, v, file) => (
    modules.set(name, { version: v, file: 'dist/' + file }),
    `./vendor/${name}/${file}`
  ),
  'jsDelivr modules',
);
page = rewrite(
  page,
  /https:\/\/unpkg\.com\/lucide@([\d.]+)/g,
  (_, v) => (
    modules.set('lucide', { version: v, file: 'dist/umd/lucide.min.js' }),
    'vendor/lucide/lucide.min.js'
  ),
  'lucide',
);
assert.equal(modules.size, 3, 'the page loads defuss-dom-router, defuss-i18n and lucide');
assert.doesNotMatch(
  page,
  /cdn\.jsdelivr\.net|unpkg\.com|["']\.\.\//,
  'index.html still loads from outside the folder',
);
const upstreamTheme = text('dist/documentation/css/docs-theme.css');
const fonts = fontsOf(upstreamTheme);

const explorer = new Map();
explorer.set('index.html', {
  from: 'dist/documentation/application/app-db-explorer.html',
  bytes: page,
});
explorer.set('docs-theme.css', {
  from: 'dist/documentation/css/docs-theme.css',
  bytes: upstreamTheme.replaceAll("url('../fonts/", "url('fonts/"),
});
for (const file of ['db-explorer.min.css', 'db-explorer.min.js'])
  explorer.set(file, { from: 'dist/apps/db-explorer/' + file });
for (const font of fonts)
  explorer.set('fonts/' + font, { from: 'dist/documentation/fonts/' + font });
const db = list('dist/documentation/js/db')
  .filter((f) => f.endsWith('.js'))
  .sort();
assert.ok(
  db.includes('db.js') && db.includes('db-worker.js'),
  'js/db holds db.js and db-worker.js',
);
for (const file of db) explorer.set('js/db/' + file, { from: 'dist/documentation/js/db/' + file });

const lock = await read('bun.lock');
const vendor = {};
const vendored = new Map();
for (const [name, { version: wanted, file }] of modules) {
  const dir = join('node_modules', name);
  const installed = await version(dir);
  assert.equal(
    installed,
    wanted,
    `the page loads ${name}@${wanted}; package.json pins ${installed}`,
  );
  for (const from of [file, 'LICENSE'])
    vendored.set(join('vendor', name, from.split('/').pop()), await readFile(join(dir, from)));
  const integrity = lock.match(
    new RegExp(`"${name}@${wanted.replaceAll('.', '\\.')}",[^\\n]*?"(sha512-[^"]+)"`),
  )?.[1];
  vendor[name] = { version: wanted, npmIntegrity: integrity ?? null, files: [file, 'LICENSE'] };
}

// -- the API Documentation app: its page is website/application/app-api-docs.html; these are what it loads
const apiDocs = new Map();
for (const file of ['api-docs.min.css', 'api-docs.min.js'])
  apiDocs.set('apps/api-docs/' + file, { from: 'dist/apps/api-docs/' + file });
apiDocs.set('css/docs-theme.css', {
  from: 'dist/documentation/css/docs-theme.css',
  bytes: upstreamTheme,
});
for (const font of fonts)
  apiDocs.set('fonts/' + font, { from: 'dist/documentation/fonts/' + font });
const upstreamPage = 'dist/documentation/application/app-api-docs.html';
const adapted = (await read('website/application/app-api-docs.html')).match(
  /app-api-docs\.html \(sha256 ([0-9a-f]{64})\)/,
)?.[1];
const upstreamSha = sha256(blob(upstreamPage));

// Every file is read before anything is written, so a missing upstream file leaves both copies as they were.
for (const copies of [explorer, apiDocs])
  for (const entry of copies.values()) entry.bytes ??= blob(entry.from);

const upstream = JSON.parse(text('package.json'));
const info = {
  version: upstream.version,
  commit,
  // the version the explorer's js/db bundle was built from: defuss-shadcn pins it exactly
  defussDb: upstream.devDependencies?.['defuss-db'] ?? upstream.dependencies?.['defuss-db'] ?? null,
  copied: new Date().toISOString(),
};
const writeCopies = async (out, copies, note, extra = {}) => {
  const files = {};
  for (const [to, { from, bytes }] of copies) {
    await mkdir(join(out, to, '..'), { recursive: true });
    await writeFile(join(out, to), bytes);
    const rewritten = typeof bytes === 'string' && bytes !== text(from) ? ' (URLs rewritten)' : '';
    files[to] = { from: from + rewritten, sha256: sha256(bytes) };
  }
  const sources = { 'defuss-shadcn': { ...info, note, files }, ...extra };
  await writeFile(join(out, 'SOURCES.json'), JSON.stringify(sources, null, 2) + '\n');
  return Object.keys(files).length;
};

await rm('docs/database-explorer', { recursive: true, force: true });
for (const [to, bytes] of vendored) {
  await mkdir(join('docs/database-explorer', to, '..'), { recursive: true });
  await writeFile(join('docs/database-explorer', to), bytes);
}
const explorerFiles = await writeCopies(
  'docs/database-explorer',
  explorer,
  'Built by defuss-shadcn, copied unchanged except the rewritten URLs. Source maps are not copied; only developer tools request them. The fonts come without licence files, as in defuss-shadcn.',
  { vendor },
);
// the generated page, its runtime and its Markdown pages (scripts/api-docs.mjs) stay
for (const path of ['apps', 'css', 'fonts', 'SOURCES.json'])
  await rm(join('docs/application', path), { recursive: true, force: true });
const apiFiles = await writeCopies(
  'docs/application',
  apiDocs,
  `Built by defuss-shadcn, copied unchanged. The page is website/application/app-api-docs.html, adapted from ${upstreamPage}; scripts/api-docs.mjs writes it here with its runtime and Markdown pages. Source maps are not copied; only developer tools request them. The fonts come without licence files, as in defuss-shadcn.`,
);

const now = () => new Date().toISOString();
console.log(
  `${now()} INFO copied defuss-shadcn ${info.version} commit=${commit.slice(0, 9)} explorer=${explorerFiles + 2 * modules.size} api-docs=${apiFiles}`,
);
if (adapted !== upstreamSha)
  console.log(
    `${now()} WARN ${upstreamPage} sha256=${upstreamSha} differs from the page website/application/app-api-docs.html was adapted from (${adapted ?? 'none named'}); carry its changes over, then name the new hash there`,
  );
