// Builds the Ledger playground from website/demo/ into docs/demo/: the page bundle (app.js), the database worker
// (worker.js, defuss-db from dist/ with its lazily loaded Brotli codecs in modules/), the theme script, HTML and CSS,
// and the defuss-shadcn 0.9.14 runtime and fonts it uses, with their licences, so the page loads nothing from
// another origin. Run `make build` first.
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';

const source = 'website/demo';
const out = 'docs/demo';
const shadcn = 'node_modules/defuss-shadcn';
const fonts = 'docs/assets/vendor/fonts';

await access('dist/browser.mjs').catch(() => {
  throw new Error(
    'dist/browser.mjs is missing: run `make build` first; the worker bundles the built package.',
  );
});
const { version } = JSON.parse(await readFile(join(shadcn, 'package.json'), 'utf8'));
if (version !== '0.9.14')
  throw new Error(`defuss-shadcn ${version} is installed; the demo is written for 0.9.14.`);
const integrity = (await readFile('bun.lock', 'utf8')).match(
  /"defuss-shadcn@0\.9\.14",[^\n]*?"(sha512-[^"]+)"/,
)?.[1];

await rm(out, { recursive: true, force: true });
const common = {
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
  // dist/browser.mjs repeats bare imports of modules it already imports by name; esbuild drops them either way.
  logOverride: { 'ignored-bare-import': 'silent' },
};
await build({ ...common, entryPoints: { app: join(source, 'app.ts') }, outdir: out });
await build({
  ...common,
  entryPoints: { worker: join(source, 'worker.ts') },
  outdir: out,
  splitting: true,
  chunkNames: 'modules/[name]-[hash]',
});
await build({
  ...common,
  format: 'iife',
  entryPoints: { theme: join(source, 'theme.ts') },
  outdir: out,
});
await cp(join(source, 'index.html'), join(out, 'index.html'));
await cp(join(source, 'app.css'), join(out, 'app.css'));

const vendor = join(out, 'vendor');
await mkdir(join(vendor, 'defuss-shadcn'), { recursive: true });
for (const file of ['core.min.css', 'all.min.css', 'all.min.js', 'NOTICE.txt'])
  await cp(join(shadcn, 'dist/components', file), join(vendor, 'defuss-shadcn', file));
await cp(join(shadcn, 'LICENSE'), join(vendor, 'defuss-shadcn', 'LICENSE'));
await cp(fonts, join(vendor, 'fonts'), { recursive: true });
await writeFile(
  join(vendor, 'SOURCES.json'),
  JSON.stringify(
    {
      'defuss-shadcn': {
        version,
        license: 'MIT',
        npmIntegrity: integrity ?? null,
        files: [
          'dist/components/core.min.css',
          'dist/components/all.min.css',
          'dist/components/all.min.js',
          'dist/components/NOTICE.txt',
          'LICENSE',
        ],
        note: 'Copied unchanged from the installed package. Their sourceMappingURL comments name maps that are not copied; only developer tools request them.',
      },
      fonts: {
        from: fonts,
        note: 'The defuss-db site’s self-hosted fonts and their OFL licences.',
      },
    },
    null,
    2,
  ) + '\n',
);

async function size(dir) {
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true }))
    bytes += entry.isDirectory()
      ? await size(join(dir, entry.name))
      : (await stat(join(dir, entry.name))).size;
  return bytes;
}
console.log(`${new Date().toISOString()} INFO built demo dir=${out} bytes=${await size(out)}`);
