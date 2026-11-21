// Prints current build metrics as key=value lines: dist bytes, packed tarball bytes and the last test/coverage run.
// VERIFIED: it reads only local build outputs and prints UNKNOWN for a report that does not exist yet.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const size = async (dir) => {
  let total = 0;
  for (const name of await readdir(dir, { recursive: true })) {
    const info = await stat(join(dir, name));
    if (info.isFile()) total += info.size;
  }
  return total;
};
const json = (path) => readFile(path, 'utf8').then(JSON.parse, () => undefined);
const { name, version } = await json('package.json');
const lines = ['dist_bytes=' + (await size('dist'))];
const packed = await stat(`output/${name}-${version}.tgz`).catch(() => undefined);
lines.push('packed_bytes=' + (packed ? packed.size : 'UNKNOWN (run make e2e)'));
const tests = await json('output/tests.json');
lines.push(
  'tests=' +
    (tests ? `${tests.numPassedTests}/${tests.numTotalTests}` : 'UNKNOWN (run make coverage)'),
);
const coverage = await json('output/coverage/coverage-summary.json');
for (const key of ['lines', 'branches', 'functions', 'statements'])
  lines.push(`coverage_${key}=` + (coverage ? coverage.total[key].pct + '%' : 'UNKNOWN'));
console.log(lines.join('\n'));
