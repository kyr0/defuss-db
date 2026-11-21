import { settleReads } from './reads.js';
import { encode } from 'defuss-dson/binary';
import { DatabaseError } from './errors.js';
import {
  FORMAT_KEY,
  assertDocument,
  indexKey,
  primary,
  primaryFromToken,
  range,
  readSchema,
  schemaKey,
  documentPrefix,
} from './keys.js';
import { storeIdentity } from './format.js';
import type { Document, Reader, Writer, Schema, IndexDefinition } from './types.js';
import type {
  HistoryChange,
  HistoryListOptions,
  HistorySegment,
  RecordedRevision,
  TimeScope,
} from './history-types.js';
import type { Row } from 'defuss-dbsonl';
import { poolBatches } from './batches.js';
import type { BatchReader } from './batches.js';

export const CLOCK = '!history-clock';
export const activationKey = (c: string) => 'k:' + c;
export const lineage = (id: string) => 'l:' + id;
const MAX_DATE = 8640000000000000n;
const hex = (v: bigint) => v.toString(16).padStart(16, '0');
const desc = (t: number) => hex(MAX_DATE - BigInt(t));
const asc = (t: number) => hex(MAX_DATE + BigInt(t));
const seqKey = (n: number) => (Number.MAX_SAFE_INTEGER - n).toString(16).padStart(14, '0');
const boundary = (c: string, p: string) => 'b:' + c + ':' + p + '!';
const forwards = (c: string, p: string) => 'j:' + c + ':' + p + '!';
export const heads = (c: string) => 'h:' + c + ':';
const facts = (c: string, p: string) => 'a:' + c + ':' + p + '!';
export const events = (c: string) => 'e:' + c + ':';
const auditPrefix = (c: string, p: string) => 'q:' + c + ':' + p + '!';
export type Origins = Record<string, number>;
interface Stamp {
  seq: number;
  ord: number;
  origins?: Origins;
  origin?: string;
}
export interface Fact extends Stamp {
  time: number;
  end: number | null;
  kind: 'seed' | 'put' | 'delete' | 'resume';
  document: Document | null;
  /** A restoration can refer directly to an immutable image, even after another correction. */
  image?: string;
  stagedSeed?: true;
}
export interface SchemaEvent extends Stamp {
  schema: Schema;
}
type Clock = { ms: number; seq: number };
type Active = Clock & { ord: number };
export const bad = (message: string): never => {
  throw new DatabaseError('CORRUPT', message);
};
export function checkedClock(v: unknown): Clock {
  const c = v as Clock;
  if (
    !c ||
    !Number.isSafeInteger(c.ms) ||
    Math.abs(c.ms) > Number(MAX_DATE) ||
    !Number.isSafeInteger(c.seq) ||
    c.seq < 1
  )
    return bad('Invalid tracked write clock.');
  return c;
}
const active = new WeakMap<Writer, Active>();
/** All tracked writes in a transaction share an effective clock and sequence. Reading and advancing
 * the same key provides rollback protection across processes. Native row receipts are assigned at commit. */
export async function clock(tx: Writer): Promise<Active> {
  let v = active.get(tx);
  if (!v) {
    const old = await tx.get(CLOCK),
      previous = old.found ? checkedClock(old.value) : undefined;
    const ms = Math.max(Date.now(), previous?.ms ?? -Number(MAX_DATE)),
      seq = (previous?.seq ?? 0) + 1;
    if (!Number.isSafeInteger(seq)) throw new RangeError('History sequence exhausted.');
    tx.put(CLOCK, { ms, seq });
    active.set(tx, (v = { ms, seq, ord: 0 }));
  }
  return v;
}
function suffix(s: Stamp) {
  return seqKey(s.seq) + ':' + seqKey(s.ord);
}
export const temporalVersionKey = (c: string) => 't:' + c;
const touched = new WeakMap<Writer, Set<string>>();
export function touchHistory(tx: Writer, c: string) {
  let names = touched.get(tx);
  if (!names) touched.set(tx, (names = new Set()));
  if (!names.has(c)) {
    tx.put(temporalVersionKey(c), 1);
    names.add(c);
  }
}
export async function stageSchemaEvent(tx: Writer, c: string, schema: Schema) {
  const state = await clock(tx);
  touchHistory(tx, c);
  const e: SchemaEvent = { seq: state.seq, ord: ++state.ord, schema };
  tx.put(events(c) + suffix(e), e);
}
/** Validates the store identity before a history write. One format marker covers tracked and untracked stores,
 * so activation needs no marker change that older readers would have to respect. VERIFIED: format.ts accepts only
 * FORMAT_VERSION. */
export async function fence(tx: Writer) {
  storeIdentity((await tx.get(FORMAT_KEY)).value);
}
export function checkCoverage(schema: Schema, time?: number) {
  if (schema.activating)
    throw new DatabaseError('HISTORY_ACTIVATING', 'The historical baseline is being built.');
  if (!schema.history)
    throw new DatabaseError('HISTORY_NOT_ENABLED', 'History is disabled for this collection.');
  if (
    time !== undefined &&
    schema.history.coverageFrom !== null &&
    time < schema.history.coverageFrom
  )
    throw new DatabaseError(
      'HISTORY_UNAVAILABLE',
      'This date precedes the baseline recorded at activation.',
    );
}
export interface Basis {
  revision: number;
  source?: string;
}
export async function resolveBasis(
  reader: Reader,
  cut?: RecordedRevision,
): Promise<Basis | undefined> {
  if (cut === undefined) return;
  const own =
    typeof cut === 'number' || cut.storeId === storeIdentity((await reader.get(FORMAT_KEY)).value);
  const revision = typeof cut === 'number' ? cut : cut.revision;
  const source = !own && typeof cut === 'object' ? cut.storeId : undefined;
  const tip = source ? (await reader.get(lineage(source))).value : reader.revision;
  if (typeof tip !== 'number' || revision > tip)
    throw new DatabaseError(
      'HISTORY_UNAVAILABLE',
      'Recorded revision is outside this snapshot or source lineage.',
    );
  return { revision, source };
}
function visible(row: Row<unknown>, basis?: Basis) {
  if (!basis) return true;
  const r = basis.source ? (row.value as Stamp).origins?.[basis.source] : row.revision;
  return r !== undefined && r <= basis.revision;
}
export async function historicalSchema(
  reader: Reader,
  c: string,
  scope?: TimeScope,
  basis?: Basis,
) {
  const present = readSchema((await reader.get(schemaKey(c))).value);
  checkCoverage(present);
  let schema = present;
  if (basis) {
    let selected: Schema | undefined;
    for await (const row of reader.scan(range(events(c))))
      if (visible(row, basis)) {
        selected = readSchema((row.value as SchemaEvent).schema);
        break;
      }
    if (!selected)
      throw new DatabaseError(
        'HISTORY_UNAVAILABLE',
        'Collection history was not enabled at this revision.',
      );
    schema = selected;
  }
  checkCoverage(schema, scope?.time);
  return schema;
}
type Winner = { key: string; fact: Fact; revision: number };
async function winner(
  reader: Reader,
  c: string,
  p: string,
  t: number,
  basis?: Basis,
): Promise<Winner | undefined> {
  const prefix = facts(c, p);
  // Time and then sequence/ordinal are descending. Current knowledge needs one bounded seek,
  // including the document body. Earlier recorded knowledge skips only ineligible assertions.
  for await (const f of reader.scan({
    gte: prefix + desc(t),
    lt: range(prefix).lt,
    ...(!basis ? { limit: 1 } : {}),
  })) {
    if (visible(f, basis)) return { key: f.key, fact: f.value as Fact, revision: f.revision };
  }
}
async function imageOf(reader: Reader, f: Fact): Promise<Document | null> {
  if (!f.image) return f.document;
  const hit = await reader.get(f.image);
  if (!hit.found || (hit.value as Fact).image) return bad('Invalid historical image pointer.');
  return (hit.value as Fact).document;
}
export async function point(
  reader: Reader,
  c: string,
  p: string,
  t: number,
  basis?: Basis,
): ReturnType<Reader['get']> {
  const match = await winner(reader, c, p, t, basis);
  if (!match) return { found: false };
  const value = await imageOf(reader, match.fact);
  return value === null ? { found: false } : { found: true, value, revision: match.revision };
}
async function nextBoundary(tx: Reader, c: string, p: string, t: number) {
  const prefix = forwards(c, p);
  for await (const row of tx.scan({ gte: prefix + asc(t) + '!', lt: range(prefix).lt, limit: 1 }))
    return row.value as number;
  return null;
}
export function projectBoundary(tx: Writer, c: string, p: string, key: string, fact: Fact) {
  tx.put(boundary(c, p) + desc(fact.time), key);
  tx.put(forwards(c, p) + asc(fact.time), fact.time);
}
export function projectAudit(tx: Writer, c: string, p: string, key: string, f: Fact) {
  if (f.kind !== 'resume') tx.put(auditPrefix(c, p) + suffix(f), key);
}
function stage(tx: Writer, c: string, p: string, v: Active, data: Omit<Fact, 'seq' | 'ord'>) {
  const f: Fact = { seq: v.seq, ord: ++v.ord, ...data };
  const key = facts(c, p) + desc(f.time) + ':' + suffix(f);
  tx.put(key, f);
  projectBoundary(tx, c, p, key, f);
  projectAudit(tx, c, p, key, f);
}
/** Current mutations already checked the live row. Scoped insert/delete resolve presence at V.
 * The ascending companion key makes an arbitrary correction's next boundary a bounded seek. */
export async function assertChange(
  tx: Writer,
  c: string,
  p: string,
  schema: Schema,
  doc: Document | null,
  scope?: TimeScope,
  insertOnly = false,
  seed = false,
): Promise<{ applied: boolean; live: boolean }> {
  if (scope?.cutoff !== undefined)
    throw new DatabaseError('HISTORY_READ_ONLY', 'A recorded cutoff is read-only.');
  let old: Winner | undefined;
  let prior: Document | null = null;
  if (scope && doc === null) {
    await validateWriteTime(tx, schema, scope);
    old = await winner(tx, c, p, scope.time);
    prior = old ? await imageOf(tx, old.fact) : null;
    if (prior === null) return { applied: false, live: false };
  }
  const v = await clock(tx),
    t = scope?.time ?? v.ms;
  checkCoverage(schema, t);
  if (t > v.ms || (scope?.until !== undefined && scope.until > v.ms))
    throw new DatabaseError('HISTORY_FUTURE_WRITE', 'Future effective writes are not supported.');
  const headKey = heads(c) + p;
  const head = scope ? ((await tx.get(headKey)).value as number | undefined) : undefined;
  const next = head !== undefined && t < head ? await nextBoundary(tx, c, p, t) : null;
  const end = scope?.until ?? next;
  if (next !== null && end !== null && end > next)
    throw new DatabaseError(
      'HISTORY_RANGE',
      'The exclusive end crosses an existing effective boundary.',
    );
  const resume = end !== null && end !== next;
  if (scope && doc !== null && (insertOnly || resume)) {
    old = await winner(tx, c, p, t);
    prior = old ? await imageOf(tx, old.fact) : null;
  }
  if (scope && insertOnly && prior !== null)
    throw new DatabaseError('DUPLICATE_KEY', 'ID exists at the selected instant.');
  touchHistory(tx, c);
  if (doc)
    for (const def of schema.indexes)
      if (def.temporalUnique)
        await checkTemporalUnique(tx, c, def, { document: doc, from: t, end });
  stage(tx, c, p, v, {
    time: t,
    end,
    kind: seed ? 'seed' : doc === null ? 'delete' : 'put',
    document: doc,
  });
  if (resume) {
    stage(tx, c, p, v, {
      time: end!,
      end: next,
      kind: 'resume',
      document: null,
      ...(prior !== null && old ? { image: old.fact.image ?? old.key } : {}),
    });
  }
  const latest = resume ? end! : t;
  if (head === undefined || latest >= head) tx.put(headKey, latest);
  return { applied: true, live: end === null };
}
export async function seedCollection(tx: Writer, c: string, schema: Schema, existing: boolean) {
  await fence(tx);
  const v = await clock(tx);
  let seeded = existing;
  if (existing) schema.history = { coverageFrom: v.ms };
  for await (const row of tx.scan(range(documentPrefix(c)))) {
    if (!seeded) {
      schema.history = { coverageFrom: v.ms };
      seeded = true;
    }
    const doc = row.value as Document;
    await assertChange(tx, c, primary(doc.id), schema, doc, undefined, false, true);
  }
}
export async function listHistory<T extends Document>(
  reader: Reader,
  c: string,
  p: string,
  basis: Basis | undefined,
  audit: boolean,
  options: HistoryListOptions,
) {
  await historicalSchema(reader, c, undefined, basis);
  options.signal?.throwIfAborted();
  const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('Invalid history limit.');
  const result: (HistorySegment<T> | HistoryChange<T>)[] = [];
  if (!limit) return result;
  const id = storeIdentity((await reader.get(FORMAT_KEY)).value);
  let activationRevision: number | undefined;
  let prev: number | undefined;
  const prefix = audit ? auditPrefix(c, p) : basis ? facts(c, p) : boundary(c, p);
  for await (const r of reader.scan({ ...range(prefix), signal: options.signal })) {
    const row = audit || !basis ? await reader.get(r.value as string) : r;
    const f = row.value as Fact;
    if (!f) return bad('Historical listing points to a missing assertion.');
    if (
      !visible({ key: r.key, value: f, revision: row.revision! }, basis) ||
      (!audit && prev === f.time)
    )
      continue;
    const end = audit ? f.end : (prev ?? null);
    prev = f.time;
    if (f.stagedSeed && !f.origins && !activationRevision)
      activationRevision = (await reader.get(activationKey(c))).revision;
    const native = f.stagedSeed && !f.origins ? activationRevision! : row.revision!;
    const rev = basis?.source ? f.origins![basis.source]! : native;
    const segment = {
      from: new Date(f.time),
      until: end === null ? null : new Date(end),
      document: ((await imageOf(reader, f)) ?? undefined) as T | undefined,
      revision: rev,
      ordinal: f.ord,
    };
    result.push(
      audit
        ? {
            ...segment,
            kind: f.kind as HistoryChange<T>['kind'],
            recorded: {
              storeId: f.origin ?? id,
              revision: f.origin ? f.origins![f.origin]! : native,
            },
          }
        : segment,
    );
    if (result.length === limit) break;
  }
  return result;
}
export function parseFact(c: string, key: string, value: unknown): { token: string; fact: Fact } {
  const prefix = 'a:' + c + ':',
    split = key.indexOf('!', prefix.length);
  const token = key.slice(prefix.length, split),
    f = value as Fact;
  if (
    !key.startsWith(prefix) ||
    split < 0 ||
    primary(primaryFromToken(token)) !== token ||
    !f ||
    !Number.isSafeInteger(f.seq) ||
    f.seq < 1 ||
    !Number.isSafeInteger(f.ord) ||
    f.ord < 1 ||
    !Number.isSafeInteger(f.time) ||
    Math.abs(f.time) > Number(MAX_DATE) ||
    !['seed', 'put', 'delete', 'resume'].includes(f.kind) ||
    !(
      f.end === null ||
      (Number.isSafeInteger(f.end) && f.end > f.time && f.end <= Number(MAX_DATE))
    ) ||
    key !== facts(c, token) + desc(f.time) + ':' + suffix(f)
  )
    return bad('Invalid immutable history fact.');
  if (f.document !== null) {
    assertDocument(f.document);
    if (primary(f.document.id) !== token) return bad('Historical document ID mismatch.');
  }
  if (
    (f.kind === 'put' || f.kind === 'seed') !== (f.document !== null) ||
    (f.image !== undefined &&
      (f.kind !== 'resume' || typeof f.image !== 'string' || !f.image.startsWith(facts(c, token))))
  )
    return bad('Invalid historical payload.');
  return { token, fact: f };
}
export function parseEvent(c: string, key: string, value: unknown): SchemaEvent {
  const e = value as SchemaEvent;
  if (
    !e ||
    !Number.isSafeInteger(e.seq) ||
    e.seq < 1 ||
    !Number.isSafeInteger(e.ord) ||
    e.ord < 1 ||
    key !== events(c) + suffix(e)
  )
    return bad('Invalid history schema event.');
  checkCoverage(readSchema(e.schema));
  return e;
}
/** One ordered pass selects one effective body per typed ID. The directory is implicit in key
 * order and includes IDs deleted today. A general historical query never probes every past ID at random. */
type ScanSignal = NonNullable<Parameters<Reader['scan']>[0]>['signal'];
export async function* visibleDocuments(
  reader: Reader,
  c: string,
  t: number,
  basis?: Basis,
  signal?: ScanSignal,
) {
  const prefix = (basis ? 'a:' : 'b:') + c + ':',
    target = desc(t);
  let consumed: string | undefined;
  const accept = (row: Row<unknown>) => {
    const split = row.key.indexOf('!', prefix.length),
      p = row.key.slice(prefix.length, split);
    if (
      p === consumed ||
      row.key.slice(split + 1, split + 17) < target ||
      (basis && !visible(row, basis))
    )
      return;
    consumed = p;
    return p;
  };
  async function load(row: Row<unknown>, p: string) {
    const hit = basis ? row : await reader.get(row.value as string);
    const fact = hit.value as Fact;
    if (!fact) return bad('Missing historical body.');
    const doc = await imageOf(reader, fact);
    return doc === null
      ? undefined
      : { key: documentPrefix(c) + p, value: doc, revision: hit.revision! };
  }
  if (!reader.scanBatches) {
    for await (const row of reader.scan({ ...range(prefix), signal })) {
      const p = accept(row);
      if (p === undefined) continue;
      const value = await load(row, p);
      if (value) yield value;
    }
    return;
  }
  // Small pointer batches amortize DBSONL traversal. Bound outstanding document loads and
  // settle all of them before returning a cancelled or failed pinned lease.
  // A consumer may stop after a few documents; the bounded first scan keeps that from starting dbsonl's pool.
  for await (const batch of poolBatches(reader as BatchReader, {
    ...range(prefix),
    signal,
    batchSize: basis ? 8 : 64,
  })) {
    let pending: ReturnType<typeof load>[] = [];
    for (const row of batch) {
      const p = accept(row);
      if (p === undefined) continue;
      pending.push(load(row, p));
      if (pending.length === 8) {
        for (const value of await settleReads(pending)) if (value) yield value;
        pending = [];
      }
    }
    if (pending.length) for (const value of await settleReads(pending)) if (value) yield value;
  }
}

export async function validateWriteTime(tx: Writer, schema: Schema, scope: TimeScope) {
  checkCoverage(schema, scope.time);
  if (scope.cutoff !== undefined)
    throw new DatabaseError('HISTORY_READ_ONLY', 'Recorded cutoffs are read-only.');
  // A missing update/delete is a true no-op; reading the clock must not allocate a commit.
  const current = active.get(tx) ?? ((await tx.get(CLOCK)).value as Clock | undefined);
  const now = Math.max(Date.now(), current?.ms ?? -Number(MAX_DATE));
  if (scope.time > now || (scope.until !== undefined && scope.until > now))
    throw new DatabaseError('HISTORY_FUTURE_WRITE', 'Future effective writes are not supported.');
}
export async function verifyTimeline(reader: Reader, c: string, schema: Schema) {
  const state = checkedClock((await reader.get(CLOCK)).value);
  const mark = await reader.get(temporalVersionKey(c));
  if (mark.value !== 1) return bad('Missing historical generation marker.');
  const activation = await reader.get(activationKey(c));
  if (!activation.found || activation.value !== schema.history!.coverageFrom)
    return bad('Invalid activation marker.');
  let count = 0,
    previousToken: string | undefined,
    previousTime: number | undefined,
    boundaries = 0,
    ids = 0,
    live = 0,
    audited = 0;
  const countPrefix = async (prefix: string) => {
    let n = 0;
    for await (const _ of reader.scan(range(prefix))) n++;
    return n;
  };
  for await (const row of reader.scan(range('a:' + c + ':'))) {
    const { token, fact } = parseFact(c, row.key, row.value);
    if (row.revision > mark.revision!) return bad('Fact exceeds historical generation.');
    if (fact.kind !== 'resume') {
      if ((await reader.get(auditPrefix(c, token) + suffix(fact))).value !== row.key)
        return bad('Invalid audit index.');
      audited++;
    }
    if (
      fact.seq > state.seq ||
      fact.time > state.ms ||
      (schema.history!.coverageFrom !== null && fact.time < schema.history!.coverageFrom!)
    )
      return bad('Historical fact falls outside its clock or coverage.');
    if (fact.image) {
      const target = await reader.get(fact.image);
      if (
        !target.found ||
        !(target.value as Fact).document ||
        (target.value as Fact).image ||
        (target.value as Fact).seq > fact.seq ||
        ((target.value as Fact).seq === fact.seq && (target.value as Fact).ord >= fact.ord)
      )
        return bad('Restoration refers to an invalid image.');
    }
    if (previousToken !== token || previousTime !== fact.time) {
      if (
        (await reader.get(boundary(c, token) + desc(fact.time))).value !== row.key ||
        (await reader.get(forwards(c, token) + asc(fact.time))).value !== fact.time
      )
        return bad('Historical boundary projection mismatch.');
      boundaries++;
      if (previousToken !== token) {
        if ((await reader.get(heads(c) + token)).value !== fact.time)
          return bad('Historical head mismatch.');
        ids++;
        const doc = await imageOf(reader, fact),
          current = await reader.get(documentPrefix(c) + token);
        if (
          (doc !== null) !== current.found ||
          (current.found && !sameDocument(doc, current.value))
        )
          return bad('Current document and open effective segment disagree.');
        if (doc !== null) live++;
      }
    }
    previousToken = token;
    previousTime = fact.time;
    count++;
  }
  if (
    audited !== (await countPrefix('q:' + c + ':')) ||
    boundaries !== (await countPrefix('b:' + c + ':')) ||
    boundaries !== (await countPrefix('j:' + c + ':')) ||
    ids !== (await countPrefix(heads(c))) ||
    live !== (await countPrefix(documentPrefix(c)))
  )
    return bad('Orphaned historical projection or live document.');
  let changes = 0;
  for await (const row of reader.scan(range(events(c)))) {
    const e = parseEvent(c, row.key, row.value);
    if (row.revision > mark.revision!) return bad('Schema event exceeds historical generation.');
    if (e.seq > state.seq || (!changes && !sameDocument(readSchema(e.schema), readSchema(schema))))
      return bad('Invalid historical schema projection.');
    changes++;
  }
  if (!changes) return bad('Missing history activation assertion.');
  for (const def of schema.indexes)
    if (def.temporalUnique) await checkTemporalUnique(reader, c, def);
  return count;
}

function sameDocument(a: unknown, b: unknown) {
  const x = encode(a),
    y = encode(b);
  return x.length === y.length && x.every((value, index) => value === y[index]);
}
/** Rare, explicitly constrained writes compare full effective intervals. The serializable range read
 * protects against a second owner appearing concurrently, including owners deleted in the live view. */
export async function checkTemporalUnique(
  reader: Reader,
  c: string,
  def: IndexDefinition,
  proposed?: { document: Document; from: number; end: number | null },
) {
  const prefix = 'b:' + c + ':',
    wanted = proposed && indexKey(c, def, proposed.document),
    owner = proposed && primary(proposed.document.id);
  const spans = new Map<string, { lo: number; hi: number }[]>();
  let last = '',
    end = Infinity;
  for await (const row of reader.scan(range(prefix))) {
    const split = row.key.indexOf('!', prefix.length),
      token = row.key.slice(prefix.length, split);
    if (token === owner) continue;
    if (token !== last) {
      last = token;
      end = Infinity;
    }
    const start = Number(MAX_DATE - BigInt('0x' + row.key.slice(split + 1))),
      upper = end;
    end = start;
    if (proposed && (upper <= proposed.from || start >= (proposed.end ?? Infinity))) continue;
    const body = await reader.get(row.value as string);
    if (!body.found) return bad('Missing historical uniqueness assertion.');
    const doc = await imageOf(reader, body.value as Fact);
    if (doc === null) continue;
    const key = indexKey(c, def, doc);
    if (proposed) {
      if (key === wanted)
        throw new DatabaseError(
          'DUPLICATE_KEY',
          'Overlapping effective intervals violate ' + def.name + '.',
        );
    } else {
      let entries = spans.get(key);
      if (!entries) spans.set(key, (entries = []));
      entries.push({ lo: start, hi: upper });
    }
  }
  for (const list of spans.values()) {
    list.sort((a, b) => a.lo - b.lo);
    for (let i = 1; i < list.length; i++)
      if (list[i]!.lo < list[i - 1]!.hi)
        throw new DatabaseError(
          'DUPLICATE_KEY',
          'Historical intervals overlap for ' + def.name + '.',
        );
  }
}

export async function seedAt(tx: Writer, c: string, doc: Document, time: number) {
  const state = await clock(tx),
    p = primary(doc.id);
  stage(tx, c, p, state, { time, end: null, kind: 'seed', document: doc, stagedSeed: true });
  tx.put(heads(c) + p, time);
}
