import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { loadReports } from './workload-report.mjs';

const root = process.cwd(),
  pkg = JSON.parse(await readFile('package.json', 'utf8'));
const tests = JSON.parse(await readFile('output/tests.json', 'utf8'));
const e2e = JSON.parse(await readFile('output/e2e-results.json', 'utf8'));
await loadReports('docs/benchmarks');
for (const runtime of ['node', 'bun']) {
  const name = 'workloads-' + runtime + '.json';
  if (!(await readFile('docs/benchmarks/' + name)).equals(await readFile('output/' + name)))
    throw Error('Site and release benchmark evidence differ.');
}
if (
  e2e.package !== pkg.name + '@' + pkg.version ||
  !tests.success ||
  tests.numTotalTests !== tests.numPassedTests ||
  e2e.browser.length !== 8 ||
  e2e.browser.some((r) => !r.ok) ||
  e2e.examples?.length !== 18
)
  throw Error('Passing release validation and measured history samples are required.');
const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const filename = `${pkg.name}-v${pkg.version}-${stamp}.zip`;
const files = {};
async function add(path) {
  const absolute = join(root, path);
  const stat = await import('node:fs/promises').then((fs) => fs.stat(absolute));
  if (stat.isDirectory())
    for (const item of (await readdir(absolute)).sort()) await add(join(path, item));
  else files[`${pkg.name}/${path}`] = new Uint8Array(await readFile(absolute));
}
for (const path of [
  'src',
  'tests',
  'scripts',
  'examples',
  'website',
  'reports',
  'docs',
  'dist',
  'README.md',
  'ARCH.md',
  'CHANGELOG.md',
  'LICENSE',
  'Makefile',
  'package.json',
  'bun.lock',
  'tsconfig.json',
  'vitest.config.ts',
  'mise.toml',
  '.env.example',
  '.gitignore',
  '.prettierrc.json',
])
  await add(path);
for (const path of [
  'output/tests.json',
  'output/e2e-results.json',
  'output/workloads-node.json',
  'output/workloads-bun.json',
  'output/browser-metafile.json',
  'output/coverage/coverage-summary.json',
  `output/${pkg.name}-${pkg.version}.tgz`,
])
  await add(path);
// A clean, unborn main branch is intentional: provenance links are not inherited Git history.
for (const path of ['.git/HEAD', '.git/config', '.git/description', '.git/info/exclude'])
  await add(path);
for (const path of [
  '.git/objects/',
  '.git/objects/info/',
  '.git/objects/pack/',
  '.git/refs/',
  '.git/refs/heads/',
  '.git/refs/tags/',
])
  files[`${pkg.name}/${path}`] = new Uint8Array();
const hashes =
  Object.entries(files)
    .filter(([name]) => !name.endsWith('/'))
    .map(
      ([name, bytes]) =>
        `${createHash('sha256').update(bytes).digest('hex')}  ${name.slice(pkg.name.length + 1)}`,
    )
    .join('\n') + '\n';
files[`${pkg.name}/SHA256SUMS`] = new TextEncoder().encode(hashes);
await mkdir('output', { recursive: true });
const target = resolve('output', filename),
  bytes = zipSync(files, { level: 9 });
await writeFile(target, bytes);
const digest = createHash('sha256').update(bytes).digest('hex');
await writeFile(target + '.sha256', `${digest}  ${filename}\n`);
console.log(
  JSON.stringify(
    { path: target, bytes: bytes.length, sha256: digest, files: Object.keys(files).length },
    null,
    2,
  ),
);
