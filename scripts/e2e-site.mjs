// Drives the generated site (docs/) in real Chromium, served by the same server `make start` runs.
// Every HTML page loads at desktop and phone width without console errors, failed requests or horizontal
// overflow; the landing page's benchmark controls, comparison charts, tabs, theme, menu, the embedded Database Explorer and playground
// run through the UI exactly as a visitor clicks them, and so do every route and Call it of the API reference app. scripts/e2e-demo.mjs drives the playground's own tabs. Results and screenshots go to output/site/.
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
// The API reference app loads its search-by-meaning model (4.6 MB from Hugging Face and jsDelivr) in the background
// unless the data saver is on. That download and the search it enables are defuss-shadcn's, tested there; here the
// app searches by keywords, as the data saver makes it.
const dataSaver = () =>
  Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
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
      if (path.startsWith('application/')) await page.addInitScript(dataSaver);
      await page.goto(origin + '/' + path, { waitUntil: 'networkidle' });
      const facts = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector('h1')?.textContent.trim() ?? '',
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        unexpanded: /@@[A-Z_]+@@/.test(document.documentElement.outerHTML),
      }));
      // VERIFIED: defuss-shadcn's Database Explorer, copied unchanged, has no h1; its toolbar names it (screenshot 2026-11-22).
      const app = path.startsWith('database-explorer/');
      assert.ok(facts.title && (facts.h1 || app), path + ' needs a title and an h1');
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

  // VERIFIED: in defuss-shadcn's explorer before 71a305fac, a first visit left during the seed, and a second tab opened
  // during it, threw "Duplicate primary key in customers." and never became ready (probe 2026-11-22). Each case gets a
  // fresh profile.
  const explorerReady = async (tab) => {
    await tab.waitForSelector('[data-dx-ready]', { state: 'attached', timeout: 60000 });
  };
  for (const concurrent of [false, true]) {
    const profile = await browser.newContext();
    const open = async () => {
      const tab = await profile.newPage();
      const tabProblems = watch(tab);
      await tab.goto(origin + '/database-explorer/');
      return { tab, tabProblems };
    };
    const first = await open();
    await first.tab.waitForSelector('[data-dx-seeding]', { state: 'attached', timeout: 30000 });
    if (!concurrent) await first.tab.close();
    const second = await open();
    await explorerReady(second.tab);
    if (concurrent) await explorerReady(first.tab);
    const label = concurrent
      ? 'a second tab during the seed'
      : 'a visit after one left during the seed';
    assert.deepEqual(
      [...first.tabProblems, ...second.tabProblems],
      [],
      'Database Explorer: ' + label,
    );
    await profile.close();
    results.interactions.push('Database Explorer ready for ' + label);
  }

  // Landing page interactions, as a visitor performs them.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const problems = watch(page);
  await page.goto(origin + '/index.html', { waitUntil: 'networkidle' });
  const step = (name) => results.interactions.push(name);

  // Hero editor: the variants rotate on their own until the visitor picks one.
  const heroSelected = () =>
    page.locator('.db-hero-tabs [role="tab"][aria-selected="true"]').getAttribute('id');
  const firstVariant = await heroSelected();
  await page.waitForFunction(
    (id) => document.querySelector('.db-hero-tabs [role="tab"][aria-selected="true"]').id !== id,
    firstVariant,
    { timeout: 5000 },
  );
  await page.click('#tab-hero-memory');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(4000);
  assert.equal(await heroSelected(), 'tab-hero-memory', 'a picked variant stays selected');
  assert.ok(await page.locator('#panel-hero-memory').isVisible(), 'memory variant panel');
  assert.match(
    await page.locator('#panel-hero-memory pre.db-diff').first().textContent(),
    /openMemory/,
  );
  step('hero editor variants rotate until picked');

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

  // The Database Explorer loads lazily in a same-origin frame and writes its sample databases to OPFS.
  await page.locator('#explorer').scrollIntoViewIfNeeded();
  const explorer = page.frameLocator('#explorer iframe');
  await explorer.locator('[data-dx-ready]').waitFor({ state: 'attached', timeout: 60000 });
  for (const name of ['shop', 'analytics', 'cms'])
    await explorer
      .locator('#dx-tree [role="treeitem"] .dx-node')
      .filter({ hasText: name })
      .first()
      .waitFor();
  assert.equal(
    await page.getAttribute('#explorer a[target="_blank"]', 'href'),
    'database-explorer/',
  );
  // The frame takes the site's theme, also after a switch on the landing page.
  const explorerDark = async () => {
    const html = (await explorer.locator('html').getAttribute('class')) ?? '';
    const box = await explorer.locator('[data-dx-dark]').isChecked();
    assert.equal(box, html.split(' ').includes('dark'), 'explorer switch matches its document');
    return box;
  };
  assert.equal(await explorerDark(), await dark(), 'explorer matches the site theme');
  await page.locator('label.swap').click();
  assert.equal(await explorerDark(), await dark(), 'explorer follows the site theme switch');
  // A visit whose stored theme differs from the system's (light here): the frame takes it when it loads.
  if (!(await dark())) await page.locator('label.swap').click();
  await page.reload();
  assert.ok(await dark(), 'the stored theme is dark');
  await page.locator('#explorer').scrollIntoViewIfNeeded();
  await explorer.locator('[data-dx-ready]').waitFor({ state: 'attached', timeout: 60000 });
  assert.equal(await explorerDark(), await dark(), 'explorer loads in the stored site theme');
  step('embedded Database Explorer with its sample databases');
  assert.deepEqual(problems, [], 'landing page interactions');
  await page.screenshot({ path: join(out, 'index-desktop.png'), fullPage: false });

  const still = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const calm = await still.newPage();
  await calm.goto(origin + '/index.html');
  await calm.waitForTimeout(3500);
  assert.equal(
    await calm.locator('.db-hero-tabs [role="tab"][aria-selected="true"]').getAttribute('id'),
    'tab-hero-browser',
    'reduced motion keeps the first variant',
  );
  await still.close();
  step('hero editor does not rotate under reduced motion');

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

  // The API reference app: every route renders its page; every member the page can run answers its example on a
  // fresh sample, the main error (a duplicate ID) reaches the answer, a member the page cannot run says why, the
  // keyword search finds a member, the theme switch is the site's, and the phone drawer closes on a pick.
  const reference = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ref = await reference.newPage();
  const refProblems = watch(ref);
  await ref.addInitScript(dataSaver);
  await ref.goto(origin + '/application/app-api-docs.html', { waitUntil: 'networkidle' });
  await ref.waitForSelector('[data-ad][data-route="#/"]');
  const routes = await ref.$$eval('[data-ad-nav] a', (links) =>
    links.map((a) => a.getAttribute('href')),
  );
  const appState = (name) => ref.getAttribute('[data-ad]', name);
  const answer = () =>
    ref.evaluate(
      () =>
        new Promise((resolve) => {
          const app = document.querySelector('[data-ad]');
          app.addEventListener('ad-rpc-answer', (e) => resolve(e.detail), { once: true });
          app.querySelector('[data-ad-rpc-try] button[type="submit"]').click();
        }),
    );
  const freshSample = () =>
    ref.evaluate(
      () =>
        new Promise((resolve) => {
          const app = document.querySelector('[data-ad]');
          app.addEventListener('ad-rpc-reset', resolve, { once: true });
          app.querySelector('[data-ad-rpc-try] button[type="reset"]').click();
        }),
    );
  const failed = [];
  let ran = 0;
  for (const route of routes) {
    await ref.evaluate((hash) => (location.hash = hash), route);
    await ref.waitForFunction(
      (hash) => document.querySelector('[data-ad]').dataset.route === hash,
      route,
    );
    const title = await ref.$eval('[data-ad-view]:not([hidden]) h1', (h) => h.textContent.trim());
    assert.ok(title, route + ' shows a title');
    if (!/^#\/ref\/\w+\/\w+$/.test(route) || (await appState('data-callable')) !== 'true') continue;
    await freshSample();
    const detail = await answer();
    ran++;
    if (!detail.ok) failed.push(route + ': ' + detail.error);
  }
  assert.deepEqual(failed, [], 'every example runs on a fresh sample');
  assert.ok(ran >= 50, `Call it ran ${ran} members`);
  step(`API reference: ${routes.length} routes, ${ran} members called`);
  await ref.evaluate(() => (location.hash = '#/ref/Collection/insert'));
  await ref.waitForSelector('[data-ad][data-route="#/ref/Collection/insert"]');
  await freshSample();
  assert.ok((await answer()).ok, 'the first insert');
  const duplicate = await answer();
  assert.ok(
    !duplicate.ok && duplicate.error.includes('DUPLICATE_KEY'),
    'the second insert of one ID',
  );
  assert.match(await ref.textContent('[data-ad-rpc-error]'), /DUPLICATE_KEY/);
  await ref.evaluate(() => (location.hash = '#/ref/Opening/openDirectory'));
  await ref.waitForSelector('[data-ad][data-route="#/ref/Opening/openDirectory"]');
  assert.match(await ref.textContent('[data-ad-rpc-conn]'), /Node\.js and Bun/);
  assert.ok(
    await ref.locator('[data-ad-rpc-actions]').isHidden(),
    'no Send for a member the page cannot run',
  );
  step('API reference: the duplicate-ID error and a member the page cannot run');
  await ref.waitForSelector('[data-ad][data-search="ready"]');
  await ref.click('[data-command-trigger="ad-find"]');
  await ref.fill('[data-ad-query]', 'pageByIndex');
  await ref.waitForSelector('[data-ad-hits] a[href="#/ref/Collection/pageByIndex"]');
  await ref.click('[data-ad-hits] a[href="#/ref/Collection/pageByIndex"]');
  await ref.waitForSelector('[data-ad][data-route="#/ref/Collection/pageByIndex"]');
  step('API reference: keyword search');
  const markdown = await ref.getAttribute('[data-ad-view]:not([hidden]) [data-ad-doc-md]', 'href');
  const response = await ref.request.get(new URL(markdown, ref.url()).href);
  assert.ok(
    response.ok() && (await response.text()).startsWith('# Collection.pageByIndex'),
    markdown,
  );
  const appDark = () => ref.evaluate(() => document.documentElement.classList.contains('dark'));
  const themeBefore = await appDark();
  await ref.locator('label.swap').click();
  assert.equal(await appDark(), !themeBefore, 'the app switches its theme');
  const site = await reference.newPage();
  await site.goto(origin + '/index.html');
  assert.equal(
    await site.evaluate(() => document.documentElement.classList.contains('dark')),
    !themeBefore,
    'the landing page opens in the theme picked in the app',
  );
  await site.close();
  step('API reference: Markdown page and the shared theme');
  assert.deepEqual(refProblems, [], 'API reference interactions');
  await ref.screenshot({ path: join(out, 'api-reference-desktop.png') });
  await reference.close();
  const refPhone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const refMobile = await refPhone.newPage();
  const refMobileProblems = watch(refMobile);
  await refMobile.addInitScript(dataSaver);
  await refMobile.goto(origin + '/application/app-api-docs.html', { waitUntil: 'networkidle' });
  await refMobile.waitForSelector('[data-ad][data-route]');
  await refMobile.click('[data-ad-menu]');
  await refMobile.waitForSelector('[data-ad][data-menu-open]');
  await refMobile.click('[data-ad-nav] a[href="#/ref/Collection/find"]');
  await refMobile.waitForSelector(
    '[data-ad][data-route="#/ref/Collection/find"]:not([data-menu-open])',
  );
  assert.deepEqual(refMobileProblems, [], 'API reference on a phone');
  step('API reference: phone drawer');
  await refPhone.close();

  results.browserVersion = browser.version();
  await writeFile(join(out, 'e2e-site.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(
    `${new Date().toISOString()} INFO site e2e passed pages=${pages.length} views=${results.pages.length} interactions=${results.interactions.length}`,
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
