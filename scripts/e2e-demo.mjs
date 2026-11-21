// Drives the Ledger playground (docs/demo/, built by scripts/demo-build.mjs) in real Chromium, served by the same
// server `make start` runs. A fresh browser context starts with empty OPFS, so the first load seeds the store; every
// tab's main interaction runs through the UI, a reload in the same context must reopen the store with the edits kept,
// and Reset data must seed it again. Desktop and phone width; any console error, page error, failed request or
// horizontal overflow fails the run. Results and screenshots go to output/demo/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = 'output/demo';
await mkdir(out, { recursive: true });
await access('docs/demo/index.html').catch(() => {
  throw new Error('docs/demo/index.html is missing: run `node scripts/demo-build.mjs` first.');
});
const SEED_TIMEOUT = 180_000;

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
const url = origin + '/demo/';
const results = {
  origin,
  timestamp: new Date().toISOString(),
  checks: [],
  timings: {},
  screenshots: [],
};
const check = (name) => results.checks.push(name);

function watch(page) {
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
}

/** Waits until the store is open; returns the chip text and the inspector's store line. */
async function opened(page, kind) {
  await page.waitForFunction(
    (word) => document.getElementById('store-chip')?.textContent?.startsWith(`OPFS · ${word}`),
    kind,
    { timeout: SEED_TIMEOUT },
  );
  await page.waitForFunction(() =>
    /\d/.test(document.querySelector('#ins-store .statistic-value')?.textContent ?? ''),
  );
  return page.locator('#ins-store .dv-store-line').textContent();
}

const seconds = (text, pattern) => {
  const match = text.match(pattern);
  assert.ok(match, `no timing in “${text}”`);
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
};

/** Runs `action`, then waits for the inspector's last call to change and match `pattern`; returns { what, ms }. */
async function act(page, action, pattern, label) {
  const before = await page.locator('#ins-ms-what').textContent();
  await action();
  await page.waitForFunction(
    ([previous, source]) => {
      const text = document.getElementById('ins-ms-what')?.textContent ?? '';
      return text !== previous && new RegExp(source).test(text);
    },
    [before, pattern.source],
    { timeout: 60_000 },
  );
  const what = await page.locator('#ins-ms-what').textContent();
  const ms = await page.locator('#ins-ms').textContent();
  if (label) results.timings[label] = { ms, what };
  return { what, ms };
}

const rows = (page, id) =>
  page.evaluate((grid) => df$.shadcn.dataGrid.rows(document.getElementById(grid)), id);
/** The Orders tab's total for the current query has arrived; returns how long count() took, as displayed. */
async function counted(page, label) {
  await page.waitForFunction(() =>
    /Counted in[\d.,]+ m?s/.test(document.getElementById('ins-stats')?.textContent ?? ''),
  );
  const text = await page.locator('#ins-stats').textContent();
  if (label)
    results.timings[label] = {
      ms: text.match(/Counted in([\d.,]+ m?s)/)[1],
      what: 'orders.count()',
    };
}

/** The store card lists every collection's count: the start-up scans are over. */
const countsShown = (page) =>
  page.waitForFunction(() =>
    /orders [\d,]+ · edits/.test(document.getElementById('ins-store')?.textContent ?? ''),
  );

async function noOverflow(page, where) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 1, `${where} overflows ${overflow}px horizontally`);
}

async function shot(page, name) {
  const path = join(out, name + '.png');
  await page.screenshot({ path, animations: 'disabled' });
  results.screenshots.push(path);
}

const tab = async (page, name) => {
  await page.click('#tab-' + name);
  await page.locator('#panel-' + name).waitFor({ state: 'visible' });
};

let browser;
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: JSON.parse(process.env.CHROMIUM_ARGS_JSON || '[]'),
  });

  // ---- desktop: first visit seeds, every tab, then a reload reopens ----------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const requested = [];
  context.on('request', (request) => requested.push(new URL(request.url()).pathname));
  const page = await context.newPage();
  const problems = watch(page);
  await page.goto(url);
  const seeded = await opened(page, 'seeded');
  results.timings.seed = { ms: seconds(seeded, /in ([\d.]+) (s|ms), then opened/), what: seeded };
  assert.ok(await page.title(), 'title');
  assert.equal((await page.locator('h1').textContent()).trim(), 'Ledger');
  check('first visit seeds OPFS and shows the store figures');

  // Orders: pages from the worker, sort, keyset paging, filter, edit
  await page.waitForFunction(
    () => df$.shadcn.dataGrid.rows(document.getElementById('orders')).length === 100,
  );
  assert.equal((await rows(page, 'orders'))[0].id, 'SO-000001');
  // The figures below are for a settled page: the first count of each query and the store counts run first.
  await counted(page, 'orders count, first after seeding');
  await countsShown(page);
  await act(
    page,
    () => page.click('#orders .data-grid-header[data-field="amount"]'),
    /orders\.query\(\): 100 orders.*100,000 documents scanned/,
    'orders sort by amount (scan)',
  );
  await counted(page);
  let amounts = (await rows(page, 'orders')).map((row) => row.amount);
  assert.ok(
    amounts.every((value, i) => i === 0 || amounts[i - 1] <= value),
    'ascending amounts',
  );
  assert.match(
    await page.locator('#ins-code').textContent(),
    /orders\.query\(\{[\s\S]*sorters: \[\{ field: 'amount', direction: 'asc' \}\]/,
  );
  check('orders: a header click sorts through orders.query() in the worker');

  await act(
    page,
    () => page.click('#ins-presets button:has-text("EU, newest first")'),
    /pageByIndex\(\): 100 orders from offset 0/,
    'orders keyset first page',
  );
  await counted(page, 'orders count, EU');
  let page1 = await rows(page, 'orders');
  assert.ok(
    page1.every((row) => row.region === 'EU'),
    'EU only',
  );
  assert.ok(
    page1.every((row, i) => i === 0 || page1[i - 1].date >= row.date),
    'newest first',
  );
  await act(
    page,
    () =>
      page
        .locator('#orders .data-grid-viewport')
        .evaluate((el) => (el.scrollTop = el.scrollHeight)),
    /pageByIndex\(\): 100 orders from offset 100/,
    'orders keyset next page',
  );
  assert.match(
    await page.locator('#ins-access').textContent(),
    /keyset cursor from the previous page/,
  );
  assert.equal((await rows(page, 'orders')).length, 200);
  await page.waitForFunction(() =>
    /Matching[\d,]+/.test(document.getElementById('ins-stats')?.textContent ?? ''),
  );
  check('orders: index-shaped query pages by pageByIndex cursor, next page on scroll');

  // The customer filter on top of EU, newest first: the planner reads EU orders through the index.
  await act(
    page,
    () => page.fill('#orders .data-grid-filter[data-field="customer"]', 'ada'),
    /orders\.query\(\)/,
    'orders EU + customer filter, newest first (index reads)',
  );
  assert.match(await page.locator('#ins-access').textContent(), /ordered index byRegionDate/);
  await counted(page);
  // The same customer filter alone: a scan that stops once the page is full.
  await act(
    page,
    () => page.click('#ins-presets button:has-text("Reset")'),
    /orders\.query\(\): 100 orders from offset 0/,
  );
  await counted(page);
  await act(
    page,
    () => page.fill('#orders .data-grid-filter[data-field="customer"]', 'ada'),
    /orders\.query\(\)/,
    'orders customer filter (scan)',
  );
  await counted(page, 'orders count, customer filter');
  const ada = await rows(page, 'orders');
  assert.ok(
    ada.length > 0 && ada.every((row) => row.customer.toLowerCase().includes('ada')),
    'customer filter',
  );
  assert.match(
    await page.locator('#ins-code').textContent(),
    /field: 'customerKey', op: 'contains', value: 'ada'/,
  );
  check('orders: a text filter queries the lower-cased name');

  await act(
    page,
    () => page.click('#ins-presets button:has-text("Reset")'),
    /orders\.query\(\): 100 orders from offset 0/,
  );
  const target = (await rows(page, 'orders'))[1];
  const edited = target.status === 'Refunded' ? 'Failed' : 'Refunded';
  await act(
    page,
    () => page.selectOption(`select[aria-label="Status of ${target.id}"]`, edited),
    new RegExp(`db\\.transaction\\(\\): ${target.id} is ${edited}`),
    'orders status edit',
  );
  await page
    .locator('#orders-edits li', { hasText: `${target.id}: ${target.status} → ${edited}` })
    .waitFor();
  check('orders: a status edit commits through db.transaction() with an audit line');
  await shot(page, 'desktop-orders');

  // Reports: every plan
  await tab(page, 'reports');
  await page.waitForFunction(
    () => /plan\.evaluate\(\)/.test(document.getElementById('ins-ms-what')?.textContent ?? ''),
    null,
    { timeout: 60_000 },
  );
  for (const name of ['monthly', 'refunds', 'vat', 'eu', 'regionProduct']) {
    await act(
      page,
      () => page.selectOption('#reports-plan', name),
      /plan\.evaluate\(\): [\d,]+ rows?/,
      `report ${name}`,
    );
    await page.waitForFunction(() => {
      const grid = document.querySelector('#reports-host .data-grid');
      return grid && df$.shadcn.dataGrid.rows(grid).length > 0;
    });
  }
  assert.match(await page.locator('#ins-code').textContent(), /orders\.prepareAggregate\(/);
  await act(
    page,
    () => page.selectOption('#reports-plan', 'monthly'),
    /plan\.evaluate\(\)/,
    'report monthly, second run',
  );
  // Second-use admission: the second run is admitted to the result cache, the third is answered from it.
  await act(page, () => page.selectOption('#reports-plan', 'refunds'), /plan\.evaluate\(\)/);
  await act(
    page,
    () => page.selectOption('#reports-plan', 'monthly'),
    /plan\.evaluate\(\): 22 rows from the result cache/,
    'report monthly, third run',
  );
  check('reports: five prepared plans evaluate and fill a grid');
  await shot(page, 'desktop-reports');

  // Price history: effective date, recorded revision, correction
  await tab(page, 'prices');
  await page.waitForFunction(
    () => df$.shadcn.dataGrid.rows(document.getElementById('prices')).length === 10,
    null,
    { timeout: 60_000 },
  );
  const price = async (sku) => (await rows(page, 'prices')).find((row) => row.id === sku)?.eur;
  assert.equal(await price('MN-270'), 339, 'corrected mid-year price, latest');
  await act(
    page,
    () => page.click('#ins-presets button:has-text("before the correction")'),
    /as recorded up to revision \d+/,
    'prices as of an earlier revision',
  );
  assert.equal(await price('MN-270'), 349, 'mid-year price as recorded before the correction');
  await act(
    page,
    () => page.click('#ins-presets button:has-text("Mar 2026, latest")'),
    /effective 2026-03-01$/,
  );
  assert.equal(await price('MN-270'), 339);
  assert.ok((await rows(page, 'prices-audit')).length >= 4, 'audit lists the recorded changes');
  await act(
    page,
    () => page.click('#correct-submit'),
    /prices\.update\(\): MN-270 is €344 from 2025-07-01 until 2025-10-01/,
    'prices correction',
  );
  const recorded = Number(
    (await page.locator('#prices-note').textContent()).match(/revision (\d+)\./)[1],
  );
  const listed = await page
    .locator('#prices-revision option')
    .evaluateAll((list) => list.map((option) => option.value));
  const before = Number(listed[listed.indexOf(String(recorded)) + 1]);
  await act(
    page,
    () => page.click('#ins-presets button:has-text("Sep 2025, latest")'),
    /effective 2025-09-01$/,
  );
  assert.equal(await price('MN-270'), 344, 'the new correction applies');
  await act(
    page,
    () => page.selectOption('#prices-revision', String(before)),
    new RegExp(`up to revision ${before}`),
  );
  assert.equal(
    await price('MN-270'),
    339,
    'the revision before the new correction keeps the old answer',
  );
  check('prices: at(date, { $asOfRevision }), history(), audit() and a recorded correction');
  await shot(page, 'desktop-prices');

  // Accounts: transfers, a failing transfer, a burst, a snapshot
  await tab(page, 'accounts');
  await page.locator('#tx-invariant[data-tone="ok"]').waitFor({ timeout: 60_000 });
  const balances = async () =>
    Object.fromEntries((await rows(page, 'accounts')).map((row) => [row.id, row]));
  const start = await balances();
  await act(
    page,
    () => page.click('#tx-send'),
    /db\.transaction\(\): €250\.00 from OPS to PAY/,
    'accounts transfer',
  );
  let now = await balances();
  assert.equal(now.OPS.balance, start.OPS.balance - 250);
  assert.equal(now.PAY.balance, start.PAY.balance + 250);
  await act(
    page,
    () => page.click('#tx-pin'),
    /db\.snapshot\(\): pinned revision \d+/,
    'accounts pin snapshot',
  );
  await act(page, () => page.click('#tx-send'), /db\.transaction\(\): €250\.00 from OPS to PAY/);
  now = await balances();
  assert.equal(now.OPS.pinned, start.OPS.balance - 250, 'the snapshot keeps the pinned balance');
  assert.equal(now.OPS.balance, start.OPS.balance - 500, 'the live balance moved on');
  await act(
    page,
    () => page.click('#tx-fail'),
    /rejected: the debit was rolled back/,
    'accounts failing transfer',
  );
  assert.match(
    await page.locator('#tx-note').textContent(),
    /Rolled back: “The credit leg failed after the debit\.” Nothing was committed: revision (\d+) before, \1 after\./,
  );
  assert.equal(
    (await balances()).OPS.balance,
    start.OPS.balance - 500,
    'nothing of the failed transfer remains',
  );
  await act(
    page,
    () => page.click('#tx-burst'),
    /\d+ transfers, each its own db\.transaction\(\), in sequence/,
    'accounts 25 transfers',
  );
  await page.locator('#tx-invariant[data-tone="ok"]').waitFor();
  assert.match(
    await page.locator('#tx-invariant').textContent(),
    /€1,000,000\.00 \(100,000,000 cents, unchanged since seeding\) · snapshot at revision \d+: €1,000,000\.00/,
  );
  await act(page, () => page.click('#tx-release'), /snapshot\.close\(\)/);
  check('accounts: atomic transfers, a rollback, an invariant and a pinned snapshot');
  await shot(page, 'desktop-accounts');

  // Search: lexical, filtered before ranking, fuzzy
  await tab(page, 'search');
  const options = () => page.locator('#item .autocomplete-option');
  await act(
    page,
    () => page.fill('#item-input', 'wireless keyboard'),
    /catalog\.search\(\): \d+ hits? of [\d,]+ match/,
    'search first query',
  );
  await options().first().waitFor();
  const first = (await options().first().textContent()).toLowerCase();
  assert.ok(first.includes('wireless') && first.includes('keyboard'), first);
  await act(
    page,
    () => page.fill('#item-input', 'wirless mouse'),
    /catalog\.search\(\)/,
    'search typo',
  );
  await options().first().waitFor();
  assert.match((await options().first().textContent()).toLowerCase(), /wireless mouse/);
  await page.selectOption('#search-category', 'Audio');
  await act(
    page,
    () => page.fill('#item-input', 'headset'),
    /catalog\.search\(\)/,
    'search with category filter',
  );
  await options().first().waitFor();
  assert.match(
    await page.locator('#ins-access').textContent(),
    /filters checked [\d,]+ documents before ranking/,
  );
  const details = await page.locator('#item .dv-option-detail').allTextContents();
  assert.ok(details.length && details.every((text) => text.startsWith('Audio')), 'category filter');
  await shot(page, 'desktop-search');
  await options().first().click();
  await page.waitForFunction(() =>
    document.querySelector('#ins-record')?.textContent?.includes('SKU-'),
  );
  check('search: catalog.search() with prefix, fuzzy and filters before ranking');
  await noOverflow(page, 'desktop');

  // The landing page's theme switch writes localStorage; the frame follows through the storage event.
  const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  const wasDark = await dark();
  const other = await context.newPage();
  await other.goto(origin + '/demo/vendor/SOURCES.json');
  await other.evaluate(
    (value) => localStorage.setItem('defuss-db-theme', value),
    wasDark ? 'light' : 'dark',
  );
  await page.waitForFunction(
    (value) => document.documentElement.classList.contains('dark') === value,
    !wasDark,
  );
  await other.close();
  await shot(page, `desktop-search-${wasDark ? 'light' : 'dark'}`);
  check('theme follows defuss-db-theme in localStorage');

  // Persistence: the same context reopens the same OPFS files.
  const revisionBefore = Number(
    (await page.locator('#store-chip').textContent()).match(/revision (\d+)/)[1],
  );
  await tab(page, 'orders');
  await page.reload();
  const reopened = await opened(page, 'reopened');
  results.timings.reopen = {
    ms: seconds(reopened, /in ([\d.]+) (s|ms), without seeding/),
    what: reopened,
  };
  const revisionAfter = Number(
    (await page.locator('#store-chip').textContent()).match(/revision (\d+)/)[1],
  );
  assert.equal(revisionAfter, revisionBefore, 'reopened at the same revision');
  await page
    .locator('#orders-edits li', { hasText: `${target.id}: ${target.status} → ${edited}` })
    .waitFor();
  await page.waitForFunction(
    () => df$.shadcn.dataGrid.rows(document.getElementById('orders')).length > 0,
  );
  assert.equal(
    (await rows(page, 'orders')).find((row) => row.id === target.id)?.status,
    edited,
    'the edit survived the reload',
  );
  await tab(page, 'accounts');
  await page.locator('#tx-invariant[data-tone="ok"]').waitFor();
  assert.ok((await rows(page, 'transfers')).length >= 3, 'transfers survived the reload');
  check('a reload reopens the store at the same revision, with the edit and the transfers');

  // Reset data: delete the files and seed again.
  page.once('dialog', (dialog) => dialog.accept());
  const resetStarted = Date.now();
  await Promise.all([page.waitForEvent('load', { timeout: SEED_TIMEOUT }), page.click('#reset')]);
  const resetMs = Date.now() - resetStarted;
  await opened(page, 'reopened');
  assert.ok(
    Number((await page.locator('#store-chip').textContent()).match(/revision (\d+)/)[1]) <
      revisionAfter,
    'a fresh store',
  );
  await tab(page, 'orders');
  await page.locator('#ins-extra', { hasText: 'Change a status in the grid' }).waitFor();
  results.timings.reset = {
    ms: resetMs,
    what: 'click to reload: close, delete the files, seed, reopen',
  };
  check('Reset data deletes the store and seeds it again');
  assert.deepEqual(problems, [], 'desktop run');
  // The worker's Brotli codecs serve archives only; the demo never loads them.
  assert.ok(requested.includes('/demo/worker.js'), 'worker requests are seen');
  assert.deepEqual(
    requested.filter((path) => path.startsWith('/demo/modules/')),
    [],
  );
  check('the browser never requests the lazily loaded archive codecs');
  await context.close();

  // ---- phone: a fresh context seeds again; every tab at 390 px without overflow ---------------------------------
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();
  const mobileProblems = watch(mobile);
  // As the site's page check sees it: right after the network settles, while the worker still seeds.
  await mobile.goto(url, { waitUntil: 'networkidle' });
  assert.ok((await mobile.title()) && (await mobile.locator('h1').textContent()).trim());
  await noOverflow(mobile, 'phone while seeding');
  await opened(mobile, 'seeded');
  await mobile.waitForFunction(
    () => df$.shadcn.dataGrid.rows(document.getElementById('orders')).length === 100,
  );
  await noOverflow(mobile, 'phone orders');
  await shot(mobile, 'phone-orders');
  await mobile.click('#orders .data-grid-header[data-field="date"]');
  await mobile.waitForFunction(
    () => df$.shadcn.dataGrid.rows(document.getElementById('orders')).length === 100,
  );
  const steps = [
    [
      'reports',
      () => mobile.selectOption('#reports-plan', 'refunds'),
      () =>
        mobile.waitForFunction(
          () =>
            document.querySelector('#reports-host .data-grid') &&
            df$.shadcn.dataGrid.rows(document.querySelector('#reports-host .data-grid')).length ===
              4,
        ),
    ],
    [
      'prices',
      () => mobile.fill('#prices-date', '2026-03-01'),
      () =>
        mobile.waitForFunction(() =>
          ['prices', 'prices-history'].every(
            (id) => df$.shadcn.dataGrid.rows(document.getElementById(id)).length >= 3,
          ),
        ),
    ],
    [
      'accounts',
      () => mobile.click('#tx-send'),
      () =>
        mobile.waitForFunction(
          () => df$.shadcn.dataGrid.rows(document.getElementById('transfers')).length === 1,
        ),
    ],
    [
      'search',
      () => mobile.fill('#item-input', 'usb hub'),
      () => mobile.locator('#item .autocomplete-option').first().waitFor(),
    ],
  ];
  for (const [name, run, done] of steps) {
    await tab(mobile, name);
    await run();
    await done();
    await noOverflow(mobile, 'phone ' + name);
    await shot(mobile, 'phone-' + name);
  }
  check('phone: every tab works at 390 px without horizontal overflow');
  assert.deepEqual(mobileProblems, [], 'phone run');
  await phone.close();

  results.browserVersion = browser.version();
  await writeFile(join(out, 'e2e-demo.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(
    `${new Date().toISOString()} INFO demo e2e passed checks=${results.checks.length} seedMs=${Math.round(results.timings.seed.ms)}`,
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
