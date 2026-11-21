import { openOPFS } from 'defuss-db/browser';
let assertions = 0;
function assert(condition: unknown, message: string) {
  assertions++;
  if (!condition) throw new Error(message);
}
self.onmessage = async (event) => {
  const { namespace, action } = event.data;
  let archive: number[] | undefined;
  const extra: Record<string, unknown> = {};
  const db = await openOPFS({ namespace });
  try {
    const docs = db.collection<any>('documents');
    if (action === 'basic') {
      const row: any = {
        id: 'native',
        date: new Date(123),
        bigint: 123n,
        bytes: new Uint8Array([1, 2]),
        map: new Map([['a', 1]]),
        set: new Set([1, 2]),
        name: 'Native',
        group: 'A',
        amount: 12,
      };
      row.self = row;
      await docs.insert(row);
      const value = await docs.get('native');
      assert(value.self === value, 'cycle');
      assert(value.date instanceof Date && value.date.getTime() === 123, 'Date');
      assert(value.bigint === 123n, 'bigint');
      assert(value.bytes instanceof Uint8Array && value.bytes[1] === 2, 'typed array');
      assert(value.map instanceof Map && value.map.get('a') === 1, 'Map');
      assert(value.set instanceof Set && value.set.size === 2, 'Set');
      await docs.insertMany([
        { id: 'b', name: 'B', group: 'A', amount: 8 },
        { id: 'c', name: 'C', group: 'B', amount: 30 },
      ]);
      await docs.createIndex({ name: 'group', fields: ['group'] });
      await docs.createIndex({ name: 'name', fields: ['name'], unique: true });
      assert(
        (await docs.explain({ filters: [{ field: 'group', op: 'eq', value: 'A' }] })).access
          .kind === 'equality',
        'index planning',
      );
      assert(
        (await docs.find({ filters: [{ field: 'group', op: 'eq', value: 'A' }] })).length === 2,
        'index lookup',
      );
      let duplicate = false;
      try {
        await docs.insert({ id: 'dup', name: 'B' });
      } catch (error) {
        duplicate = (error as { code: string }).code === 'DUPLICATE_KEY';
      }
      assert(duplicate && !(await docs.has('dup')), 'unique rollback');
      const q = docs.q;
      const groups = await docs.aggregate({
        groupBy: { group: q.field('group') },
        measures: { total: q.sum(q.field('amount')), n: q.count() },
        orderBy: [{ field: 'total', direction: 'desc' }],
      });
      assert(
        groups.rows[0].group === 'B' && groups.rows[0].total === 30 && groups.rows[1].total === 20,
        'aggregation',
      );
      const view = await docs.view(
        { select: { label: q.field('name') }, totals: { total: q.sum(q.field('amount')) } },
        { limit: 1 },
      );
      assert(view.rows.length === 1 && view.totals.total === 50, 'page and totals');
      const selected = await docs.select({
        select: { label: q.field('name'), double: q.mul(q.field('amount'), q.literal(2)) },
        where: q.or(q.eq(q.field('group'), q.literal('B')), q.gt(q.field('amount'), q.literal(10))),
      });
      assert(selected.rows.length === 2, 'Boolean projection');
      const snapshot = await db.snapshot();
      await docs.update('b', { amount: 99 });
      await db.compact();
      await db.collect();
      assert(
        (await snapshot.collection<any>('documents').get('b')).amount === 8,
        'snapshot across compaction',
      );
      await snapshot.close();
      let rollback = false;
      try {
        await db.transaction(async (tx) => {
          await tx.collection('other').insert({ id: 'abort' });
          throw new Error('abort');
        });
      } catch {
        rollback = true;
      }
      assert(rollback && !(await db.collection('other').has('abort')), 'multi-collection rollback');
      await db.transaction(async (tx) => {
        await tx.collection('other').insert({ id: 'ok' });
        await tx.collection<any>('documents').update('c', { amount: 31 });
      });
      assert(await db.collection('other').has('ok'), 'multi-collection commit');
      const stream = docs.stream({}, { batchSize: 1 });
      const first = await stream.next();
      assert(!first.done, 'stream');
      await stream.return(undefined);
      assert((await db.verify()).documents === 4, 'index verification');
      await docs.update('native', { vector: new Float32Array([1, 0]) });
      await docs.update('b', { vector: new Float32Array([0, 1]) });
      await docs.createSearchIndex({
        name: 'words',
        kind: 'lexical',
        text: { fields: { text: { path: 'name' } } },
      });
      await docs.createSearchIndex({
        name: 'vectors',
        kind: 'vector',
        vector: { path: 'vector', dimensions: 2 },
      });
      await docs.createSearchIndex({
        name: 'hybrid',
        kind: 'hybrid',
        text: { fields: { text: { path: 'name' } } },
        vector: { path: 'vector', dimensions: 2 },
      });
      assert((await docs.search('words', 'Native')).hits[0].id === 'native', 'OPFS lexical');
      assert(
        (await docs.search('vectors', { text: '', vector: [0, 1] })).hits[0].id === 'b',
        'OPFS vector',
      );
      assert(
        (await docs.search('hybrid', { text: 'Native', vector: [1, 0] })).hits[0].id === 'native',
        'OPFS hybrid',
      );
      const searchSnapshot = await db.snapshot();
      await docs.update('native', { name: 'Changed' });
      assert((await docs.search('words', 'Native')).hits.length === 0, 'OPFS search invalidation');
      assert(
        (await searchSnapshot.collection('documents').search('words', 'Native')).hits[0].id ===
          'native',
        'OPFS search snapshot',
      );
      await searchSnapshot.close();
      await db.verify();
      await docs.count({}, { cache: true });
      await docs.count({}, { cache: true });
      await docs.count({}, { cache: true });
      assert(db.queryCacheStats()!.hits > 0, 'OPFS query cache hit');
      await docs.createIndex({ name: 'feed', fields: ['group', 'amount'], order: ['asc', 'desc'] });
      const top = await docs.query({
        filters: [{ field: 'group', op: 'eq', value: 'A' }],
        sorters: [{ field: 'amount', direction: 'desc' }],
        limit: 1,
      });
      assert(top.summary.strategy === 'ordered' && top.rows[0].id === 'b', 'OPFS ordered top-k');
      const firstPage = await docs.pageByIndex('feed', { prefix: ['A'], limit: 1 });
      await db.collection('other').put({ id: 'ok' });
      assert(
        (await docs.pageByIndex('feed', { prefix: ['A'], limit: 1, after: firstPage.nextCursor! }))
          .rows[0].id === 'native',
        'OPFS seek after unrelated write',
      );
      const keys = await docs.pageIdsByIndex('feed', { prefix: ['A'], limit: 1 });
      assert(keys.rows[0] === 'b' && !!keys.nextCursor, 'OPFS index-only IDs');
      assert(
        (await docs.countByIndex('feed', { prefix: ['A'] })) === 2,
        'OPFS exact interval count',
      );
      assert(
        (await docs.pageByIndex('feed', { prefix: ['A'], after: keys.nextCursor! })).rows[0]?.id ===
          'native',
        'OPFS mixed cursor modes',
      );
      const compressed = await db.export({ blockBytes: 1024 });
      archive = Array.from(compressed);
      const restored = await openOPFS({ namespace: namespace + '-restore' });
      try {
        await restored.import(
          new ReadableStream({
            start(controller) {
              controller.enqueue(compressed);
              controller.close();
            },
          }),
        );
        const native = await restored.collection<any>('documents').get('native');
        assert(
          native.self === native && native.date.getTime() === 123,
          'OPFS archive native graph',
        );
        assert(
          (
            await restored
              .collection('documents')
              .search('hybrid', { text: 'Changed', vector: [1, 0] })
          ).hits[0].id === 'native',
          'OPFS archive search rebuild',
        );
        assert((await restored.verify()).documents === 4, 'OPFS archive integrity');
      } finally {
        await restored.close();
      }
      for (const runtime of ['node', 'bun']) {
        const incoming = await openOPFS({ namespace: namespace + '-' + runtime });
        try {
          const response = await fetch('/' + runtime + '.dfdb.br');
          await incoming.import(response.body!);
          assert(
            (await incoming.collection<any>('items').get(1)).at.getTime() === 123,
            runtime + ' archive into OPFS',
          );
          assert(
            (await incoming.collection<any>('items').pageByIndex('orderedAmount', { limit: 1 }))
              .rows[0].amount === 5,
            runtime + ' ordered index archive into OPFS',
          );
          assert(
            (
              await incoming
                .collection('items')
                .search('search', { text: 'searchable', vector: [1, 0] })
            ).hits[0].id === 3,
            runtime + ' archive search into OPFS',
          );
        } finally {
          await incoming.close();
        }
      }
      const automatic = await openOPFS({ namespace: namespace + '-automatic' });
      try {
        const rows = automatic.collection('rows');
        await rows.insertMany(Array.from({ length: 256 }, (_, id) => ({ id, n: id })));
        await rows.count();
        await rows.count();
        assert(
          (await rows.count()) === 256 && automatic.queryCacheStats()!.hits === 1,
          'OPFS automatic result cache',
        );
        await automatic.collection('audit').put({ id: 'independent' });
        assert(
          (await rows.count()) === 256 && automatic.queryCacheStats()!.crossRevisionHits === 1,
          'OPFS cache reuse across unrelated commits',
        );
        automatic.clearQueryCache();
        const counts = await Promise.all(Array.from({ length: 4 }, () => rows.count()));
        assert(
          counts.every((count) => count === 256),
          'OPFS concurrent default queries',
        );
        // OPFS snapshot opens may serialize enough for the first scan to finish before a follower
        // joins. Both ordinary hits and overlapping-miss reuse are valid schedules.
        const cacheStats = automatic.queryCacheStats()!;
        assert(cacheStats.hits + cacheStats.coalesced >= 3, 'OPFS concurrent cache reuse');
        await rows.insert({ id: 'new' });
        assert((await rows.count()) === 257, 'OPFS automatic invalidation');
      } finally {
        await automatic.close();
      }
      await db.collection('counter').put({ id: 'main', n: 0 });
    } else if (action === 'reopen') {
      assert((await docs.get('native')).date.getTime() === 123, 'persistent Date');
      assert((await docs.get('b')).amount === 99, 'persistent update');
      assert((await docs.indexes()).length === 3, 'persistent schemas');
      assert(
        (await docs.search('words', 'Changed')).hits[0].id === 'native',
        'OPFS lexical reopen',
      );
      assert(
        (await docs.search('vectors', { text: '', vector: [0, 1] })).hits[0].id === 'b',
        'OPFS vector reopen',
      );
      assert(
        (await docs.search('hybrid', { text: 'Changed', vector: [1, 0] })).hits[0].id === 'native',
        'OPFS hybrid reopen',
      );
      await db.verify();
    } else if (action === 'increment') {
      for (let i = 0; i < 12; i++)
        for (;;) {
          try {
            await db.collection<any>('counter').update('main', (row) => ({ ...row, n: row.n + 1 }));
            break;
          } catch (error) {
            if ((error as { code: string }).code !== 'CONFLICT') throw error;
          }
        }
    } else if (action === 'check') {
      assert((await db.collection<any>('counter').get('main')).n === 24, 'cross-worker counter');
      await db.verify();
    } else if (action === 'history') {
      const c = await db.ensureCollection<any>('historic', { $trackHistory: true });
      const row: any = { id: 1n, value: 5n, date: new Date(-1) };
      row.self = row;
      await c.at(new Date(0)).put(row);
      const prior = (await db.stats()).revision;
      await db.collection<any>('testmeta').put({ id: 1, prior });
      await c.at(new Date(5)).update(1n, { value: 9n });
      await c.at(new Date(10)).delete(1n);
      assert(
        (await c.at(new Date(6), { $asOfRevision: prior }).get(1n)).value === 5n,
        'original belief in OPFS',
      );
    } else if (action === 'historyReopen') {
      await db.compact();
      await db.collect();
      const c = db.collection<any>('historic');
      const prior = (await db.collection<any>('testmeta').get(1)).prior;
      const v = await c.at(new Date(6)).get(1n);
      assert(
        v.value === 9n && v.self === v && !(await c.has(1n)),
        'OPFS reopen after historical deletion and compaction',
      );
      assert((await c.audit(1n)).length === 3, 'OPFS durable audit');
      await db.verify();
      Object.assign(extra, {
        storeId: db.storeId,
        prior,
        historyArchive: Array.from(await db.export({ history: 'full', collections: ['historic'] })),
      });
    } else if (action === 'importHistory') {
      const other = await openOPFS({ namespace: namespace + '-server-archive' });
      try {
        const { archive, storeId, prior } = event.data.serverHistory;
        await other.import(new Uint8Array(archive));
        const c = other.collection<any>('prices');
        const v = await c.at(new Date(4), { $asOfRevision: { storeId, revision: prior } }).get(1n);
        assert(
          v.value === 10n && v.self === v && v.bin[2] === 3,
          'server history imported into a fresh OPFS namespace',
        );
        assert(
          (await c.at(new Date(4)).get(1n)).value === 20n && !(await c.has(1n)),
          'corrected belief and current tombstone in OPFS',
        );
        await other.verify();
      } finally {
        await other.close();
      }
    } else throw new Error('Unknown browser action');
    const stats = await db.stats();
    assert(stats.durability === 'file', 'browser durability');
    await db.close();
    self.postMessage({ ok: true, assertions, action, archive, ...extra });
  } catch (error) {
    await db.close();
    self.postMessage({ ok: false, error: error instanceof Error ? error.stack : String(error) });
  }
};
