import { feedCaption, formatMs as ms } from './bench-format.js';
const $ = (id) => document.getElementById(id);
const theme = $('theme-toggle');
const root = document.documentElement;
theme.checked = root.classList.contains('dark');
theme.addEventListener('change', () => {
  root.classList.toggle('dark', theme.checked);
  root.style.colorScheme = theme.checked ? 'dark' : 'light';
  try {
    localStorage.setItem('defuss-db-theme', root.style.colorScheme);
  } catch {}
});

// ECharts is used only when the benchmark section approaches the viewport.
const charts = JSON.parse($('bench-data').textContent);
const choice = { runtime: 'Node', storage: 'memory' };
let chartReady = false;
function displayBench() {
  const selected = charts.filter(
    (r) => r.runtime === choice.runtime && r.backend === choice.storage,
  );
  const find = (workload, path) => selected.find((r) => r.workload === workload && r.path === path);
  for (const card of document.querySelectorAll('.db-latency')) {
    const r = find(card.dataset.workload, card.dataset.path);
    card.querySelector('output').textContent = ms(r.medianMs) + ' ms';
  }
  const indexed = find('tenant-feed', 'ordered'),
    scan = find('tenant-feed', 'scan');
  const caption = feedCaption(choice.runtime, choice.storage, indexed, scan);
  $('insert-indexed').textContent = ms(find('append-events', 'ordered').medianMs) + ' ms';
  $('insert-plain').textContent = ms(find('append-events', 'plain').medianMs) + ' ms';
  $('bench-context').textContent = caption;
  const el = $('bench-chart');
  el.setAttribute('aria-label', caption);
  if (!chartReady) return;
  const ui = window.df$.shadcn.chart;
  ui.mount(el, {
    aria: { enabled: true, label: { description: caption } },
    animation: false,
    grid: { left: 5, right: 78, top: 8, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => ms(v) + ' ms' },
    xAxis: { type: 'value', min: 0, axisLabel: { formatter: (v) => v + ' ms', hideOverlap: true } },
    yAxis: { type: 'category', inverse: true, data: ['Compound index', 'Collection scan'] },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        label: {
          show: true,
          position: 'right',
          formatter: (p) => ms(p.value) + ' ms',
          color: ui.color(el, '--foreground'),
        },
        data: [
          {
            value: indexed.medianMs,
            itemStyle: { color: ui.color(el, '--db-chart-a'), borderRadius: [0, 4, 4, 0] },
          },
          {
            value: scan.medianMs,
            itemStyle: { color: ui.color(el, '--db-chart-b'), borderRadius: [0, 4, 4, 0] },
          },
        ],
      },
    ],
  });
}
for (const group of document.querySelectorAll('.db-vs-controls .toggle-group')) {
  group.addEventListener('click', (event) => {
    const pick = event.target.closest('button[data-value]');
    if (!pick) return;
    for (const b of group.querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b === pick));
    choice[group.dataset.key] = pick.dataset.value;
    displayBench();
  });
}
document
  .querySelector('[data-show-server]')
  .addEventListener('click', () => $('tab-server').click());
// Hero editor: one example for the browser, a server and memory. While the rotation runs, the selected tab's bar fills
// in 3 s (site.css) and its animationend selects the next tab with a synthetic click. A reader's own click or key on
// the tabs stops the rotation; hovering the window or focusing its code pauses it. Reduced motion never starts it.
const heroTabs = document.querySelector('.db-hero-tabs');
const heroTriggers = [...heroTabs.querySelectorAll('[role="tab"]')];
const stopHero = () => delete heroTabs.dataset.auto;
heroTabs.addEventListener('click', (event) => {
  if (event.isTrusted && event.target.closest('[role="tab"]')) stopHero();
});
heroTabs.addEventListener('keydown', (event) => {
  if (event.target.closest('[role="tab"]')) stopHero();
});
heroTabs.addEventListener('animationend', (event) => {
  if (heroTabs.dataset.auto !== 'on' || !heroTriggers.includes(event.target)) return;
  heroTriggers[(heroTriggers.indexOf(event.target) + 1) % heroTriggers.length].click();
});
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) heroTabs.dataset.auto = 'on';
// The MongoDB comparison: relative speed per operation on a log2 axis, then each operation's two medians on its own
// linear scale. VERIFIED: the medians span 0.015 ms to 4.5 s (docs/benchmarks/mongodb-node.json), so one shared axis
// would hide the small ones.
const mongo = JSON.parse($('mongo-data').textContent);
const mongoChoice = { runtime: 'Node', size: Math.max(...mongo[0].sizes) };
const sizeGroup = $('mongo-sizes');
for (const size of mongo[0].sizes) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toggle';
  button.dataset.value = String(size);
  button.setAttribute('aria-pressed', String(size === mongoChoice.size));
  button.textContent = size.toLocaleString('en-US');
  sizeGroup.append(button);
}
const times = (r) =>
  r.workload === 'bulk-load'
    ? [r.defussMs / 1000, r.mongoMs / 1000, ' s']
    : [r.defussMs, r.mongoMs, ' ms'];
const value = (n, unit) => ms(n) + unit;
// Axis names short enough for a phone; the tooltip and the per-operation charts carry the full names.
const shortNames = {
  'point-get': 'Read by ID',
  'tenant-feed': 'Top 20 by index',
  'range-count': 'Range count',
  'group-totals': 'Full-scan aggregate',
  'update-one': 'Update one',
  'update-concurrent': '32 writers update',
  'insert-batch': 'Insert 64',
  'bulk-load': 'Bulk load',
};
// Each bar is the paired time ratio of the run's rounds (scripts/bench-stats.mjs), its whisker the 95% confidence
// interval. Side and color say which system was faster, and only when the whole interval agrees; the label says by
// how much, or "same".
const relative = (r) =>
  r.verdict === 'same' ? 'same' : (r.ratio < 1 ? 1 / r.ratio : r.ratio).toFixed(1) + '×';
const interval = (r) =>
  `${r.ratio.toFixed(2)}× the time (95% CI ${r.low.toFixed(2)}–${r.high.toFixed(2)}, ${r.rounds} rounds)`;
function displayMongo() {
  const report = mongo.find((r) => r.runtime === mongoChoice.runtime);
  const rows = report.rows.filter((r) => r.size === mongoChoice.size);
  const count = (verdict) => rows.filter((r) => r.verdict === verdict).length;
  const caption = `${report.runtime === 'Node' ? 'Node.js' : 'Bun'} ${report.runtimeVersion}, ${mongoChoice.size.toLocaleString('en-US')} documents: at 95% confidence defuss-db was faster in ${count('faster')} of ${rows.length} operations, slower in ${count('slower')}, and the runs could not tell the systems apart in ${count('same')}.`;
  $('mongo-caption').textContent = caption;
  const grid = $('mongo-grid');
  if (grid.children.length !== rows.length)
    grid.replaceChildren(
      ...rows.map(() => {
        const cell = document.createElement('div');
        cell.className = 'db-mini';
        cell.append(
          document.createElement('h4'),
          document.createElement('p'),
          Object.assign(document.createElement('div'), { className: 'chart' }),
        );
        cell.lastChild.setAttribute('role', 'img');
        return cell;
      }),
    );
  rows.forEach((r, i) => {
    const [defuss, other, unit] = times(r);
    const cell = grid.children[i];
    cell.querySelector('h4').textContent = r.label;
    cell.querySelector('p').textContent = `defuss-db: ${r.defussPath} · ${r.mongoPath}`;
    cell.lastChild.setAttribute(
      'aria-label',
      `${r.label}: defuss-db ${value(defuss, unit)}, ${r.mongoPath} ${value(other, unit)} (medians); defuss-db ${interval(r)}`,
    );
  });
  if (!chartReady) return;
  const ui = window.df$.shadcn.chart;
  const ratio = $('mongo-ratio');
  const [a, b, same, ink, muted] = [
    '--db-chart-a',
    '--db-chart-b',
    '--db-chart-same',
    '--foreground',
    '--muted-foreground',
  ].map((token) => ui.color(ratio, token));
  // Right of zero means defuss-db took less time.
  const logs = rows.map((r) => -Math.log2(r.ratio));
  const ends = rows.map((r) => [-Math.log2(r.high), -Math.log2(r.low)]);
  // One spare step on each side keeps the labels beyond the whiskers inside the plot.
  const reach = Math.ceil(Math.max(...ends.flat().map(Math.abs))) + 1;
  ui.mount(ratio, {
    aria: { enabled: true, label: { description: caption } },
    animation: false,
    grid: { left: 5, right: 18, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const r = rows[p.dataIndex],
          [defuss, other, unit] = times(r);
        return `${r.label}<br>defuss-db (${r.defussPath}): ${value(defuss, unit)} median<br>${r.mongoPath}: ${value(other, unit)} median<br>defuss-db: ${interval(r)}`;
      },
    },
    xAxis: {
      type: 'value',
      min: -reach,
      max: reach,
      interval: 1,
      splitLine: { lineStyle: { color: muted, opacity: 0.25 } },
      axisLabel: {
        color: muted,
        hideOverlap: true,
        formatter: (v) => (v === 0 ? 'same' : 2 ** Math.abs(v) + '×'),
      },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => shortNames[r.workload] ?? r.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ink },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        data: logs.map((v, i) => ({
          value: v,
          itemStyle: {
            color: { faster: a, slower: b, same }[rows[i].verdict],
            borderRadius: v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: muted, type: 'solid' },
          data: [{ xAxis: 0 }],
        },
      },
      {
        // The 95% confidence interval as a whisker with end caps, and the label just beyond it.
        type: 'custom',
        silent: true,
        z: 3,
        data: rows.map((_, i) => [ends[i][0], ends[i][1], i]),
        encode: { x: [0, 1], y: 2 },
        renderItem: (params, api) => {
          const [x0, y] = api.coord([api.value(0), api.value(2)]);
          const [x1] = api.coord([api.value(1), api.value(2)]);
          const right = logs[params.dataIndex] >= 0;
          const style = { stroke: ink, lineWidth: 1.5 };
          const cap = (x) => ({ type: 'line', shape: { x1: x, y1: y - 5, x2: x, y2: y + 5 }, style });
          return {
            type: 'group',
            children: [
              { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style },
              cap(x0),
              cap(x1),
              {
                type: 'text',
                style: {
                  text: relative(rows[params.dataIndex]),
                  x: right ? Math.max(x0, x1) + 6 : Math.min(x0, x1) - 6,
                  y,
                  align: right ? 'left' : 'right',
                  verticalAlign: 'middle',
                  fill: ink,
                  font: '12px "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
                },
              },
            ],
          };
        },
      },
    ],
  });
  rows.forEach((r, i) => {
    const [defuss, other, unit] = times(r);
    const el = grid.children[i].lastChild;
    ui.mount(el, {
      animation: false,
      grid: { left: 2, right: 64, top: 4, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', valueFormatter: (v) => value(v, unit) },
      xAxis: { type: 'value', min: 0, show: false },
      yAxis: {
        type: 'category',
        inverse: true,
        data: ['defuss-db', 'MongoDB'],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: muted },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          label: {
            show: true,
            position: 'right',
            color: ink,
            formatter: (p) => value(p.value, unit),
          },
          data: [
            { value: defuss, itemStyle: { color: a, borderRadius: [0, 4, 4, 0] } },
            { value: other, itemStyle: { color: b, borderRadius: [0, 4, 4, 0] } },
          ],
        },
      ],
    });
  });
}
for (const group of document.querySelectorAll('.db-mongo-controls .toggle-group')) {
  group.addEventListener('click', (event) => {
    const pick = event.target.closest('button[data-value]');
    if (!pick) return;
    for (const b of group.querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b === pick));
    mongoChoice[group.dataset.mongo] =
      group.dataset.mongo === 'size' ? Number(pick.dataset.value) : pick.dataset.value;
    displayMongo();
  });
}
theme.addEventListener('change', displayBench);
theme.addEventListener('change', displayMongo);
displayBench();
displayMongo();
function loadChart() {
  const script = document.createElement('script');
  script.src = new URL('./vendor/charts/echarts.min.js', import.meta.url).href;
  script.onload = () => {
    if (window.df$?.shadcn?.chart) {
      chartReady = true;
      displayBench();
      displayMongo();
    }
  };
  script.onerror = () => {
    $('bench-chart').hidden = true;
    $('mongo-ratio').hidden = true;
  };
  document.head.append(script);
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        loadChart();
      }
    },
    { rootMargin: '240px' },
  );
  observer.observe($('bench-chart'));
  observer.observe($('mongo-ratio'));
} else loadChart();

// The playground frame is same-origin and follows the theme through the storage event (website/demo/theme.ts).
// replace(): a restart must not add an entry to the tab's history.
$('playground-restart').addEventListener('click', () => {
  const frame = document.querySelector('#demo iframe');
  frame.contentWindow?.location.replace(frame.src);
});
