import { postings } from './history-index-cache.js';
import { DatabaseError } from './errors.js';
import { documentPrefix, indexKey, primary, schemaKey, FORMAT_KEY } from './keys.js';
import { searchPrefix, searchStateKey, inputBytes, projectSearch } from './search-config.js';
import {
  historicalSchema,
  point,
  resolveBasis,
  temporalVersionKey,
  visibleDocuments,
} from './history-store.js';
import { versionKey } from './collection-version.js';
import type { TimeScope } from './history-types.js';
import type { Row } from 'defuss-dbsonl';
import type { Reader, ReadContext } from './types.js';

export function temporalContext(parent: ReadContext, c: string, scope: TimeScope): ReadContext {
  const dp = documentPrefix(c);
  const remote = typeof scope.cutoff === 'object' ? scope.cutoff.storeId : 'local';
  const namespace = 'history/' + c + '/' + scope.time + '/' + remote;
  const open = async () => {
    const lease = await parent.open();
    try {
      const raw = lease.reader,
        requested = await resolveBasis(raw, scope.cutoff);
      const revision = requested?.revision ?? raw.revision;
      // A committed snapshot pinned to its own head can use current-knowledge seeks. A transaction
      // overlay has staged rows beyond its base revision and must still apply the explicit cutoff.
      const basis =
        raw.scanBatches && !requested?.source && requested?.revision === raw.revision
          ? undefined
          : requested;
      const schema = await historicalSchema(raw, c, scope, basis);
      let version: Promise<number> | undefined;
      const temporalVersion = () =>
        (version ??=
          requested?.source || parent.cursorMutation
            ? Promise.resolve(revision)
            : raw
                .get(temporalVersionKey(c))
                .then((mark) => Math.min(revision, mark.revision ?? revision)));
      const generation = async () =>
        namespace +
        '/' +
        (await temporalVersion()) +
        '/' +
        (parent.cursorMutation ? parent.cursorIdentity?.() + '/' + parent.cursorMutation() : '');
      const groups = new Map<string, Promise<Row<unknown>[]>>();
      // Only an explicitly requested named index needs materialization. Streaming document scans
      // and bounded point reads bypass every secondary/search projection.
      async function build(
        kind: string,
        index: string,
        signal?: NonNullable<Parameters<Reader['scan']>[0]>['signal'],
      ) {
        const rows: Row<unknown>[] = [];
        if (kind === 'p' || kind === 'g') {
          const def = schema.searchIndexes.find((d) => d.name === index);
          if (!def)
            throw new DatabaseError('SCHEMA_MISMATCH', 'Undefined historical search index.');
          let bytes = 0;
          for await (const row of visibleDocuments(raw, c, scope.time, basis, signal)) {
            const input = projectSearch(row.value, def);
            bytes += inputBytes(input);
            if (rows.length >= def.maxDocuments! || bytes > def.maxInputBytes!)
              throw new RangeError('Historical search corpus exceeds index capacity.');
            rows.push({
              key: searchPrefix(c, index) + primary(row.value.id),
              value: input,
              revision,
            });
          }
          rows.push({
            key: searchStateKey(c, index),
            value: { documents: rows.length, bytes, generation: await generation() },
            revision,
          });
        } else {
          const indexDef = schema.indexes.find((d) => d.name === index);
          if (!indexDef)
            throw new DatabaseError('SCHEMA_MISMATCH', 'Undefined historical secondary index.');
          // Live unique keys may have several historical owners. The planner uses nonunique postings here.
          const def = indexDef.unique ? { ...indexDef, unique: false } : indexDef;
          for await (const row of visibleDocuments(raw, c, scope.time, basis, signal)) {
            const token = primary(row.value.id);
            rows.push({ key: indexKey(c, def, row.value, token), value: token, revision });
          }
        }
        rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        return rows;
      }
      async function group(
        key: string,
        signal?: NonNullable<Parameters<Reader['scan']>[0]>['signal'],
      ) {
        const [kind, name, index] = key.split(':');
        if (name !== c || !index || !['i', 'u', 'o', 'p', 'g'].includes(kind!))
          return Promise.resolve([]);
        const id = (kind === 'g' ? 'p' : kind) + ':' + index;
        let result = groups.get(id);
        if (!result) {
          const owner =
            kind === 'p' || kind === 'g' || parent.cursorMutation ? undefined : parent.queryCache;
          const cacheKey = owner ? (await generation()) + '/' + id : '',
            epoch = owner?.epoch;
          const existing = postings(owner, cacheKey);
          result = existing
            ? Promise.resolve(existing)
            : build(kind!, index, signal).then((rows) => {
                if (owner?.epoch === epoch) postings(owner, cacheKey, rows);
                return rows;
              });
          groups.set(id, result);
        }
        return result;
      }
      function lower(rows: readonly Row<unknown>[], key: string) {
        let lo = 0,
          hi = rows.length;
        while (lo < hi) {
          const m = Math.floor((lo + hi) / 2);
          if (rows[m]!.key < key) lo = m + 1;
          else hi = m;
        }
        return lo;
      }
      const reader: Reader = {
        temporal: true,
        searchGeneration: generation,
        temporalVersion,
        revision,
        async get(key) {
          if (key.startsWith(dp)) return point(raw, c, key.slice(dp.length), scope.time, basis);
          if (key === schemaKey(c)) return { found: true, value: schema, revision };
          if (key === versionKey(c)) return { found: true, value: 1, revision };
          if (key === FORMAT_KEY) return raw.get(key);
          const rows = await group(key),
            hit = rows[lower(rows, key)];
          return hit?.key === key ? { found: true, value: hit.value, revision } : { found: false };
        },
        async *scan(opts = {}) {
          let left = opts.limit ?? Infinity;
          if (left <= 0) return;
          const start = opts.gte ?? '',
            stop = opts.lt;
          const rows = start.startsWith(dp)
            ? visibleDocuments(raw, c, scope.time, basis, opts.signal)
            : undefined;
          if (rows) {
            for await (const row of rows) {
              if (stop !== undefined && row.key >= stop) break;
              if (row.key < start) continue;
              yield row;
              if (--left === 0) break;
            }
          } else {
            const index = await group(start, opts.signal);
            for (let i = lower(index, start); i < index.length && left > 0; i++, left--) {
              if (opts.signal?.aborted) throw opts.signal.reason ?? new Error('Aborted');
              const row = index[i]!;
              if (stop !== undefined && row.key >= stop) break;
              yield row;
            }
          }
        },
      };
      return { reader, close: lease.close };
    } catch (error) {
      await lease.close();
      throw error;
    }
  };
  return {
    temporalScope: scope,
    temporalParent: parent,
    check: parent.check,
    open,
    lookupConcurrency: parent.lookupConcurrency,
    searchCache: parent.searchCache,
    queryCache: parent.queryCache,
    cacheNamespace: namespace,
    cursorMutation: parent.cursorMutation,
    cursorIdentity: () => parent.cursorIdentity?.() + '/' + namespace,
    ...(scope.cutoff === undefined && !parent.cursorMutation
      ? { atRevision: (r: number) => temporalContext(parent, c, { ...scope, cutoff: r }) }
      : {}),
    async get(key) {
      const lease = await open();
      try {
        return await lease.reader.get(key);
      } finally {
        await lease.close();
      }
    },
  };
}
