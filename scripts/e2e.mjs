import { mkdtemp, readFile, writeFile, copyFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = process.cwd(),
  output = resolve('output');
await mkdir(output, { recursive: true });
const consumer = await mkdtemp(join(tmpdir(), 'defuss-db-packed-'));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const results = {
  package: 'defuss-db@' + version,
  checks: [],
  browser: [],
  node: process.version,
  timestamp: new Date().toISOString(),
};
function command(binary, args, cwd = root) {
  return new Promise((accept, reject) => {
    const child = spawn(binary, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? accept(output) : reject(new Error(`${binary} ${args.join(' ')}: ${output}`)),
    );
  });
}
let server, browser;
try {
  await command('bun', ['pm', 'pack', '--destination', output]);
  const tarball = join(output, 'defuss-db-' + version + '.tgz');
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'packed-consumer', private: true, type: 'module' }),
  );
  await command('bun', ['add', tarball], consumer);
  await copyFile('tests/history-packed.mjs', join(consumer, 'history-packed.mjs'));
  for (const binary of [process.execPath, 'bun'])
    await command(binary, ['history-packed.mjs'], consumer);
  results.checks.push(
    'Packed temporal directory persistence, compact, collect, cyclic typed data and source-qualified restore on Node and Bun',
  );
  const sample = `import assert from 'node:assert/strict';
import {openMemory, forRows, DatabaseError, StorageError, DbsonlError, inferSchema, checkSchema, validateValue, ValidationError, COLLECTIONS} from 'defuss-db';
import {openDirectory} from 'defuss-db/server';
import {openOPFS} from 'defuss-db/browser';
assert.equal(typeof openOPFS,'function'); assert.equal(typeof forRows,'function');
assert.equal(typeof DatabaseError,'function'); assert.equal(typeof StorageError,'function'); assert.equal(typeof DbsonlError,'function');
const db=await openMemory(); const c=db.collection('items');
await c.insertMany([{id:1,amount:5,at:new Date(123)},{id:2,amount:7,at:new Date(124)}]);
await c.createIndex({name:'amount',fields:['amount'],unique:true});
assert.equal((await c.find({filters:[{field:'amount',op:'eq',value:5}]}))[0].at.getTime(),123);
const q=c.q; assert.deepEqual((await c.aggregate({measures:{sum:q.sum(q.field('amount'))}})).rows,[{sum:12}]);
await c.createSearchIndex({name:'search',kind:'hybrid',text:{fields:{text:{path:'text'}}},vector:{path:'embedding',dimensions:2}});
await c.put({id:3,text:'searchable document',embedding:new Float32Array([1,0])});
assert.equal((await c.search('search',{text:'searchable',vector:[1,0]})).hits[0].id,3);
assert.deepEqual((await c.getMany([1,99,2])).map(x=>x?.id),[1,undefined,2]);
await c.createIndex({name:'orderedAmount',fields:['amount'],order:['asc']});
assert.equal((await c.pageByIndex('orderedAmount',{limit:1})).rows[0].amount,5);
const packed=await db.export(); await (await import('node:fs/promises')).writeFile((process.versions.bun?'bun':'node')+'.dfdb.br',packed); const restored=await openMemory(); await restored.import(packed); assert.equal((await restored.collection('items').get(1)).at.getTime(),123); await restored.verify(); await restored.close(); await c.count({}, {cache:true}); await c.count({}, {cache:true}); await c.count({}, {cache:true}); assert.ok(db.queryCacheStats().hits);
const stamped=await openMemory();const notes=await stamped.ensureCollection('notes',{$trackHistory:true,$timestamps:true});await notes.insert({id:'n',text:'a'});const created=(await notes.get('n'))._createdAt;assert.ok(created instanceof Date);await notes.delete('n');assert.equal((await notes.history('n'))[0].document,undefined);assert.equal(await notes.restore('n'),true);const back=await notes.get('n');assert.equal(back._createdAt.getTime(),created.getTime());assert.ok(back._updatedAt>=created);const nq=notes.q;const ages=await notes.aggregate({measures:{age:nq.max(nq.sub(nq.epochMs(nq.field('_updatedAt')),nq.epochMs(nq.field('_createdAt'))))}});assert.equal(ages.rows[0].age,back._updatedAt-back._createdAt);await stamped.verify();await stamped.close();
const kept=await openMemory();const prices=await kept.ensureCollection('prices',{$trackHistory:true});for(const t of [0,10,20])await prices.at(new Date(t)).put({id:'p',eur:t});await prices.at(new Date(0)).put({id:'gone',eur:1});await prices.at(new Date(5)).delete('gone');assert.deepEqual(await prices.pruneHistory({before:new Date(15)}),{documents:1,versions:1});assert.equal(await prices.get('p',{$historic:new Date(5)}),undefined);assert.equal((await prices.get('p',{$historic:new Date(15)})).eur,10);assert.equal(await prices.restore('gone',{validate:false}),true);await prices.delete('gone');assert.equal((await prices.pruneDeleted({ids:['gone']})).documents,1);assert.deepEqual(await prices.history('gone'),[]);await kept.verify();await kept.close();
const automatic=await openMemory();const ac=automatic.collection('rows');await ac.insertMany(Array.from({length:256},(_,id)=>({id,n:id})));await ac.count();await ac.count();assert.equal(await ac.count(),256);assert.equal(automatic.queryCacheStats().hits,1);await automatic.close();
const guarded=await openMemory();const events=guarded.collection('events');await events.insertMany([{id:'a',type:'search',path:'/help'},{id:'b',type:'click',path:'/'}]);const suggested=inferSchema(await events.find());assert.deepEqual(suggested.properties.type,{type:'string',enum:['search','click']});assert.equal(suggested.properties.path.format,'path');checkSchema(suggested);assert.equal((await events.setSchema(suggested)).invalid,0);const refused=await events.insert({id:'c',type:'scroll',path:'/'}).catch(e=>e);assert.ok(refused instanceof ValidationError);assert.equal(refused.code,'VALIDATION_FAILED');assert.equal(refused.issues[0].path,'/type');await events.insert({id:'c',type:'scroll',path:'/'},{validate:false});assert.equal((await events.validateDocument('c'))[0].keyword,'enum');await events.delete('c');assert.deepEqual(validateValue(suggested.properties.path,'a b').map(i=>i.keyword),['format']);assert.deepEqual(await events.validateDocument('a'),[]);await events.setSchema({type:'object',properties:{type:{type:'string',enum:['click']}}});const checked=await events.validateCollection({limit:1});assert.equal(checked.invalid,1);assert.ok(checked.warning.startsWith('WARNING >= 1 document of events violates its schema'));await guarded.ensureCollection('made');assert.deepEqual((await guarded.collection(COLLECTIONS).find()).map(e=>e.id),['events','made']);assert.equal((await events.schema()).properties.type.enum[0],'click');await guarded.verify();const moved=await openMemory();await moved.import(await guarded.export());assert.equal((await moved.collection('events').schema()).properties.type.enum[0],'click');await moved.close();await guarded.close();
await db.close(); const disk=await openDirectory('./data'); await disk.collection('test').put({id:'x',n:1n}); await disk.close();
const reopened=await openDirectory('./data'); assert.equal((await reopened.collection('test').get('x')).n,1n); await reopened.verify(); await reopened.close();
const par=await openDirectory('./par-'+(process.versions.bun?'bun':'node'),{parallel:{workers:2,minRows:10}}); const pc=par.collection('rows'); await pc.insertMany(Array.from({length:500},(_,id)=>({id,g:id%3,v:id}))); await pc.count({},{cache:false}); while((await par.stats()).parallel.state==='starting') await new Promise(r=>setTimeout(r,5)); assert.equal((await par.stats()).parallel.state,'ready'); const pq=pc.q; const pr=await pc.aggregate({groupBy:{g:pq.field('g')},measures:{n:pq.count(),s:pq.sum(pq.field('v'))},orderBy:[{field:'g',direction:'asc'}],numberMode:'exact'},undefined,{cache:false}); assert.equal(pr.summary.strategy,'merge'); assert.deepEqual(pr.rows,[{g:0,n:167,s:41583},{g:1,n:167,s:41750},{g:2,n:166,s:41417}]); assert.equal(await pc.count({},{cache:false}),500); assert.equal((await par.stats()).parallel.queries,2); await par.close();
const off=await openDirectory('./par-'+(process.versions.bun?'bun':'node'),{parallel:false}); assert.equal((await off.stats()).parallel,undefined); await off.close();`;
  await writeFile(join(consumer, 'consumer.mjs'), sample);
  await command(process.execPath, ['consumer.mjs'], consumer);
  results.checks.push(
    'Node packed ESM + directory + timestamps, durations and restore + history pruning + schema validation and _collections + parallel aggregates in worker threads',
  );
  await command('bun', ['consumer.mjs'], consumer);
  results.checks.push(
    'Bun packed ESM + directory + timestamps, durations and restore + history pruning + schema validation and _collections + parallel aggregates in worker threads',
  );
  await writeFile(
    join(consumer, 'consumer.cjs'),
    `const assert=require('node:assert/strict'); const db=require('defuss-db'); const server=require('defuss-db/server'); const browser=require('defuss-db/browser'); const mongo=require('defuss-db/mongo'); assert.equal(typeof server.openDirectory,'function'); assert.equal(typeof browser.openOPFS,'function'); (async()=>{const d=await db.openMemory();await d.collection('test').insert({id:1});assert.equal(await d.collection('test').count(),1);assert.deepEqual(await mongo.findMongo(d.collection('test'),'{ id: { $gte: 1 } }'),[{id:1}]);assert.deepEqual(await mongo.aggregateMongo(d.collection('test'),'[{ $count: "n" }]'),[{n:1}]);assert.deepEqual((await db.analyzeSchema(d.collection('test'))).schema.required,['id']);await d.collection('test').setSchema({type:'object',required:['id']});assert.equal(db.validateValue({type:'string',format:'uri'},'https://example.com').length,0);assert.equal((await d.collection(db.COLLECTIONS).get('test')).id,'test');await d.collection('test').createSearchIndex({name:'words',kind:'lexical',text:{fields:{text:{path:'text'}}}});await d.collection('test').put({id:2,text:'search'});assert.equal((await d.collection('test').search('words','search')).hits[0].id,2);const backup=await d.export();const restored=await db.openMemory();await restored.import(backup);assert.equal(await restored.collection('test').count(),2);await restored.close();await d.close();const native=await server.openDirectory('./data-cjs');await native.collection('cjs').put({id:'x',at:new Date(123)});assert.equal((await native.collection('cjs').get('x')).at.getTime(),123);await native.close();const par=await server.openDirectory('./par-cjs-'+(process.versions.bun?'bun':'node'),{parallel:{workers:2,minRows:10}});const pc=par.collection('rows');await pc.insertMany(Array.from({length:100},(_,id)=>({id})));await pc.count({},{cache:false});while((await par.stats()).parallel.state==='starting')await new Promise(r=>setTimeout(r,5));assert.equal(await pc.count({},{cache:false}),100);assert.equal((await par.stats()).parallel.queries,1);await par.close()})().catch(error=>{console.error(error);process.exitCode=1});`,
  );
  await command(process.execPath, ['consumer.cjs'], consumer);
  results.checks.push('Node packed CommonJS all entries (mongo, analyzeSchema) + parallel count');
  await command('bun', ['consumer.cjs'], consumer);
  results.checks.push('Bun packed CommonJS all entries (mongo, analyzeSchema) + parallel count');
  await writeFile(
    join(consumer, 'types.mts'),
    `import {openMemory,type Document,type IndexPage,type Timestamped} from 'defuss-db';
interface Row extends Document {id:bigint;name:string;amount:number}
const db=await openMemory();const c=db.collection<Row>('rows');const q=c.q;
const rows=await c.select({select:{title:q.field('name'),doubled:q.mul(q.field('amount'),q.literal(2))}});
await c.createIndex({name:'feed',fields:['amount'],order:['desc']});
const page:IndexPage<Row>=await c.pageByIndex('feed',{lte:100,limit:5});const item:Row|undefined=page.rows[0];void item;
const idPage:IndexPage<bigint>=await c.pageIdsByIndex('feed',{lte:100});const key:bigint|undefined=idPage.rows[0];void key;
const count:number=await c.countByIndex('feed',{lte:100,maxScannedEntries:1000});void count;
const tracked=await db.ensureCollection<Row>('prices',{$trackHistory:true});const historic=new Date(0);
await tracked.at(historic).put({id:1n,name:'price',amount:5});
const pruned:Promise<{documents:number;versions:number}>=tracked.pruneHistory({from:historic,before:new Date(1),ids:[1n]});void pruned.catch(()=>{});void tracked.pruneDeleted({before:historic}).catch(()=>{});void tracked.insert({id:2n,name:'legacy',amount:1},{validate:false}).catch(()=>{});
const readonly=tracked.at(historic,{$asOfRevision:1});const past:Row|undefined=await readonly.get(1n);void past;
// @ts-expect-error a collection bound to a recorded cutoff is read-only
readonly.delete(1n);
const notes=await db.ensureCollection<Timestamped<{id:string;text:string}>>('notes',{$timestamps:true});
const note=await notes.get('n');const updated:Date|undefined=note?._updatedAt;void updated;const restored:Promise<boolean>=notes.restore('n',{validate:false});void restored.catch(()=>{});
// @ts-expect-error maintained timestamps cannot be inserted
void notes.insert({id:'m',text:'b',_createdAt:new Date()}).catch(()=>{});
const own=db.collection<{id:string;_createdAt:Date}>('own');void own.insert({id:'o',_createdAt:new Date()}).catch(()=>{});void own.update('o',{_createdAt:new Date()}).catch(()=>{});
const title:string=rows.rows[0]!.title;const value:number|null=rows.rows[0]!.doubled;void title;void value;
// @ts-expect-error projections exclude unselected fields
rows.rows[0]!.amount;
const sum=await c.aggregate({measures:{n:q.count(),total:q.sum(q.field('amount'))}});const total:number|null=sum.rows[0]!.total;void total;
// @ts-expect-error field names are checked
q.field('unknown');
await db.close();`,
  );
  const ambient = join(consumer, 'empty-ambient-types');
  await mkdir(ambient);
  await command(
    process.execPath,
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--typeRoots',
      ambient,
      '--strict',
      '--noEmit',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--skipLibCheck',
      '--lib',
      'ES2022',
      'types.mts',
    ],
    consumer,
  );
  results.checks.push('Packed TypeScript inference without DOM or Node ambient types');
  await copyFile(resolve('tests/browser-entry.ts'), join(consumer, 'worker.ts'));
  const bundled = await build({
    absWorkingDir: consumer,
    entryPoints: ['worker.ts'],
    outfile: join(output, 'worker.mjs'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    metafile: true,
    sourcemap: true,
  });
  if (
    Object.keys(bundled.metafile.inputs).some((path) =>
      /@lickle|defuss-db\/dist\/server|onnxruntime|transformers|defuss-multicore/.test(path),
    )
  )
    throw new Error('Native server dependency leaked into browser build');
  await writeFile(join(output, 'browser-metafile.json'), JSON.stringify(bundled.metafile, null, 2));
  results.checks.push('Packed browser bundle excludes native locks and server entry');
  // Bundle the seven browser examples against the installed tarball.
  await copyFile(resolve('tests/browser-examples.ts'), join(consumer, 'examples-worker.ts'));
  await build({
    absWorkingDir: consumer,
    entryPoints: ['examples-worker.ts'],
    outfile: join(output, 'examples-worker.mjs'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
  });
  server = createServer(async (request, response) => {
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'",
    );
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>defuss-db OPFS verification</title>');
    } else if (request.url === '/worker.mjs' || request.url === '/examples-worker.mjs') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(join(output, request.url.slice(1))));
    } else if (request.url === '/node.dfdb.br' || request.url === '/bun.dfdb.br') {
      response.setHeader('Content-Type', 'application/octet-stream');
      response.end(await readFile(join(consumer, request.url.slice(1))));
    } else if (request.url === '/favicon.ico') {
      response.writeHead(204);
      response.end();
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    headless: true,
    args: [...JSON.parse(process.env.CHROMIUM_ARGS_JSON || '[]'), '--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`http://127.0.0.1:${port}`);
  const serverHistory = {
    archive: Array.from(await readFile(join(consumer, 'history-node.dfdb.br'))),
    ...JSON.parse(await readFile(join(consumer, 'history-node.json'), 'utf8')),
  };
  const reports = await page.evaluate(async (serverHistory) => {
    const namespace = 'db-test-' + crypto.randomUUID();
    function run(action) {
      return new Promise((resolve, reject) => {
        const worker = new Worker('/worker.mjs', { type: 'module' });
        const timer = setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker timeout'));
        }, 30000);
        worker.onerror = (event) => {
          clearTimeout(timer);
          worker.terminate();
          reject(new Error(event.message));
        };
        worker.onmessage = (event) => {
          clearTimeout(timer);
          worker.terminate();
          if (event.data.ok) resolve(event.data);
          else reject(new Error(event.data.error));
        };
        worker.postMessage({
          namespace,
          action,
          ...(action === 'importHistory' ? { serverHistory } : {}),
        });
      });
    }
    const results = [await run('basic'), await run('reopen')];
    results.push(...(await Promise.all([run('increment'), run('increment')])));
    results.push(
      await run('check'),
      await run('history'),
      await run('historyReopen'),
      await run('importHistory'),
    );
    return results;
  }, serverHistory);
  results.examples = await page.evaluate(async () => {
    const worker = new Worker('/examples-worker.mjs', { type: 'module' });
    let sequence = 0;
    const checks = [];
    function run(action, fields = {}) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error(action + ' timed out')), 30000);
        worker.onerror = (e) => {
          clearTimeout(timer);
          reject(Error(e.message));
        };
        worker.onmessage = ({ data }) => {
          clearTimeout(timer);
          if (data.error) reject(Error(action + ' ' + data.error));
          else resolve(data.value);
        };
        worker.postMessage({ action, sequence: ++sequence, ...fields });
      });
    }
    const check = (ok, label) => {
      if (!ok) throw Error(label);
      checks.push(label);
    };
    try {
      const first = await run('feed', { tenant: 'eu' });
      check(
        first.total === 8 && first.ids.join(',') === 'evt-115,evt-113,evt-111' && !!first.next,
        'ordered ID page and count',
      );
      const next = await run('feed', { tenant: 'eu', after: first.next });
      check(next.ids.join(',') === 'evt-109,evt-107,evt-105', 'cursor continuation');
      const groups = await run('group');
      check(
        groups.rows.length === 2 && groups.rows.every((r) => r.events === 8),
        'grouped DataView counts',
      );
      const pinned = await run('pin'),
        written = await run('write'),
        stale = await run('conflict');
      check(
        pinned.pinned === 12 &&
          written.pinned === 12 &&
          written.live === 13 &&
          stale.live === 14 &&
          stale.conflict === 'CONFLICT',
        'snapshot and rejected stale writer',
      );
      check((await run('release')).pinned === null, 'snapshot release');
      for (const mode of ['lexical', 'vector', 'hybrid']) {
        const answer = await run('search', { mode, topic: 'search' });
        check(
          answer.hits.length > 0 && answer.hits.every((r) => r.title && Number.isFinite(r.score)),
          mode + ' search',
        );
      }
      for (const [effective, recorded, amount, latest] of [
        ['jan10', 'original', 100, 100],
        ['jan10', 'corrected', 100, 100],
        ['jan15', 'original', 100, 110],
        ['jan15', 'corrected', 110, 110],
        ['jan20', 'original', 100, 110],
        ['jan20', 'corrected', 110, 110],
        ['feb01', 'original', 120, 120],
        ['feb01', 'corrected', 120, 120],
      ]) {
        const h = await run('history', { effective, recorded });
        check(
          h.amount === amount &&
            h.latestAmount === latest &&
            h.currentAmount === 120 &&
            h.correctedRevision >= h.asOfRevision,
          'history ' + effective + ' ' + recorded,
        );
      }
      const archive = await run('archive');
      check(
        archive.bytes > 0 && archive.types.length === 5 && archive.types.every(([, ok]) => ok),
        'Brotli archive restored five native graph checks',
      );
      const zero = await run('reset'),
        inc = await run('increment'),
        reopened = await run('reopen');
      check(zero.count === 0 && inc.count === 1 && reopened.count === 1, 'OPFS close and reopen');
      return checks;
    } finally {
      worker.terminate();
    }
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const archiveReport = reports.find((report) => report.archive);
  if (!archiveReport) throw new Error('Missing browser archive');
  await writeFile(join(consumer, 'browser.dfdb.br'), Buffer.from(archiveReport.archive));
  delete archiveReport.archive;
  await writeFile(
    join(consumer, 'interop.mjs'),
    `import {readFile} from 'node:fs/promises'; import assert from 'node:assert/strict'; import {openMemory} from 'defuss-db'; const db=await openMemory(); await db.import(await readFile('browser.dfdb.br')); const r=await db.collection('documents').get('native');assert.equal(r.date.getTime(),123);assert.equal(r.self,r);assert.equal((await db.collection('documents').pageByIndex('feed',{prefix:['A'],limit:1})).rows[0].id,'b');await db.verify();await db.close();`,
  );
  await command(process.execPath, ['interop.mjs'], consumer);
  await command('bun', ['interop.mjs'], consumer);
  results.checks.push('Bidirectional Brotli archive interchange: Chromium OPFS, Node and Bun');
  const temporal = reports.find((r) => r.action === 'historyReopen');
  await writeFile(join(consumer, 'browser-history.dfdb.br'), Buffer.from(temporal.historyArchive));
  delete temporal.historyArchive;
  await writeFile(
    join(consumer, 'browser-history.mjs'),
    `import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {openMemory} from 'defuss-db';const db=await openMemory();await db.import(await readFile('browser-history.dfdb.br'));const c=db.collection('historic');assert.equal(await c.has(1n),false);assert.equal((await c.at(new Date(6)).get(1n)).value,9n);assert.equal((await c.at(new Date(6),{$asOfRevision:${JSON.stringify({ storeId: temporal.storeId, revision: temporal.prior })}}).get(1n)).value,5n);await db.verify();await db.close();`,
  );
  for (const binary of [process.execPath, 'bun'])
    await command(binary, ['browser-history.mjs'], consumer);
  results.checks.push(
    'Full-history Brotli archive Node → Chromium OPFS and Chromium OPFS → Node/Bun with original recorded cutoffs',
  );
  results.browser = reports;
  results.browserVersion = browser.version();
  results.browserArgs = JSON.parse(process.env.CHROMIUM_ARGS_JSON || '[]');
  results.checks.push(
    'Chromium real OPFS: persistence, native values, queries, index integrity, rollback, snapshots, cross-worker coordination',
  );
  await writeFile(join(output, 'e2e-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(consumer, { recursive: true, force: true });
}
