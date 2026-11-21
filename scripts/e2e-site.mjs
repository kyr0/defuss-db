// Drives the generated site (docs/) in real Chromium, served by the same server `make start` runs.
// Every HTML page loads at desktop and phone width without console errors, failed requests or horizontal
// overflow; the landing page's benchmark controls, comparison charts, tabs, theme, menu and the embedded playground
// run through the UI exactly as a visitor clicks them. scripts/e2e-demo.mjs drives the playground's own tabs. Results and screenshots go to output/site/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = 'output/site';
await mkdir(out, { recursive: true });
const pages = (await readdir('docs', { recursive: true }))
  .filter((p) => p.endsWith('.html'))
  .sort();
assert.ok(pages.includes('index.html') && pages.length > 1, 'run `make site` first');

const server = spawn(process.execPath, ['scripts/serve-site.mjs'], {
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const origin = await new Promise((resolve, reject) => {
  let buffer = '';
  server.stdout.on('data', (chunk) => {
    buffer += chunk;
    const match = buffer.match(/url=(http:\/\/127\.0\.0\.1:\d+)/);
    if (match) resolve(match[1]);
  });
  server.once('exit', (code) => reject(Error('site server exited with ' + code)));
});

const results = { origin, timestamp: new Date().toISOString(), pages: [], interactions: [] };
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: JSON.parse(process.env.CHROMIUM_ARGS_JSON || '[]'),
  });
  const watch = (page) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
    page.on('requestfailed', (r) =>
      problems.push('requestfailed: ' + r.url() + ' ' + r.failure()?.errorText),
    );
    page.on(
      'response',
      (r) => r.status() >= 400 && problems.push('http ' + r.status() + ': ' + r.url()),
    );
    return problems;
  };

  for (const [label, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['phone', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    for (const path of pages) {
      const page = await context.newPage();
      const problems = watch(page);
      await page.goto(origin + '/' + path, { waitUntil: 'networkidle' });
      const facts = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector('h1')?.textContent.trim() ?? '',
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        unexpanded: /@@[A-Z_]+@@/.test(document.documentElement.outerHTML),
      }));
      assert.ok(facts.title && facts.h1, path + ' needs a title and an h1');
      assert.ok(!facts.unexpanded, path + ' contains an unexpanded site token');
      assert.ok(
        facts.overflow <= 1,
        `${path} overflows ${facts.overflow}px horizontally at ${label} width`,
      );
      assert.deepEqual(problems, [], path + ' at ' + label);
      results.pages.push({ path, viewport: label, title: facts.title });
      await page.close();
    }
    await context.close();
  }

  // Landing page interactions, as a visitor performs them.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const problems = watch(page);
  await page.goto(origin + '/index.html', { waitUntil: 'networkidle' });
  const step = (name) => results.interactions.push(name);

  const caption = () => page.locator('#bench-context').textContent();
  const before = await caption();
  await page.click('.toggle-group[data-key="runtime"] button[data-value="Bun"]');
  await page.click('.toggle-group[data-key="storage"] button[data-value="directory"]');
  assert.notEqual(await caption(), before, 'benchmark caption follows runtime and storage');
  await page.locator('#bench-chart').scrollIntoViewIfNeeded();
  await page.locator('#bench-chart canvas, #bench-chart svg').first().waitFor({ timeout: 10000 });
  step('benchmark toggles and chart');

  const mongoCaption = () => page.locator('#mongo-caption').textContent();
  await page.locator('#mongo-ratio').scrollIntoViewIfNeeded();
  await page.locator('#mongo-ratio canvas, #mongo-ratio svg').first().waitFor({ timeout: 10000 });
  const operations = await page.locator('#mongo-grid .db-mini').count();
  assert.ok(operations >= 8, 'one chart per compared operation');
  assert.equal(
    await page
      .locator('#mongo-grid .db-mini .chart')
      .evaluateAll((charts) => charts.filter((c) => c.querySelector('canvas, svg')).length),
    operations,
    'every operation chart renders',
  );
  const nodeCaption = await mongoCaption();
  await page.click('.toggle-group[data-mongo="runtime"] button[data-value="Bun"]');
  await page.click('#mongo-sizes button:first-child');
  assert.notEqual(await mongoCaption(), nodeCaption, 'comparison caption follows runtime and size');
  assert.match(await mongoCaption(), /^Bun /);
  step('MongoDB comparison toggles and charts');

  const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  const wasDark = await dark();
  await page.locator('label.swap').click();
  assert.equal(await dark(), !wasDark, 'theme toggle');
  step('theme toggle');

  for (const tab of ['server', 'browser', 'query', 'install']) {
    await page.click('#tab-' + tab);
    assert.ok(await page.locator('#panel-' + tab).isVisible(), tab + ' tab panel');
  }
  step('setup tabs');

  // The playground loads lazily in a same-origin frame; Restart reloads it in place.
  await page.locator('#demo').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('#demo iframe');
  await frame.locator('h1').filter({ hasText: 'Ledger' }).waitFor({ timeout: 30000 });
  // A new document in the frame drops the global this marker sets on the old one.
  await page.evaluate(
    () => (document.querySelector('#demo iframe').contentWindow.e2eBefore = true),
  );
  await page.click('#playground-restart');
  await page.waitForFunction(() => !document.querySelector('#demo iframe').contentWindow.e2eBefore);
  await frame.locator('h1').filter({ hasText: 'Ledger' }).waitFor({ timeout: 30000 });
  assert.equal(await page.getAttribute('#demo a[target="_blank"]', 'href'), 'demo/');
  step('embedded playground and restart');
  assert.deepEqual(problems, [], 'landing page interactions');
  await page.screenshot({ path: join(out, 'index-desktop.png'), fullPage: false });

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await phone.newPage();
  const mobileProblems = watch(mobile);
  await mobile.goto(origin + '/index.html', { waitUntil: 'networkidle' });
  await mobile.click('[data-sheet-trigger="db-sheet"]');
  await mobile.locator('#db-sheet').waitFor({ state: 'visible' });
  await mobile.click('#db-sheet a[href="#install"]');
  await mobile.locator('#db-sheet').waitFor({ state: 'hidden' });
  assert.deepEqual(mobileProblems, [], 'phone menu');
  step('phone menu');
  await mobile.screenshot({ path: join(out, 'index-phone.png'), fullPage: false });

  results.browserVersion = browser.version();
  await writeFile(join(out, 'e2e-site.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(
    `${new Date().toISOString()} INFO site e2e passed pages=${pages.length} views=${results.pages.length} interactions=${results.interactions.length}`,
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
