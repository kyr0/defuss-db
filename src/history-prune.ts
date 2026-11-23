/**
 * Removes recorded history of a tracked collection. pruneHistory() removes versions that ended; pruneDeleted()
 * removes deleted documents with every version. Live documents, their indexes and search data are never touched.
 *
 * A version is an effective segment of one ID: from one boundary to the next. pruneHistory({ from, before }) removes
 * the segments that began at or after `from` and ended at or before `before`, with every assertion recorded for
 * them. It keeps the segment in effect at `before` and every later one, a version a later bounded correction
 * resumes, and what restore() needs to bring a deleted document back.
 *
 * Why a removed range reads as absent, and not as the version before it: that version ended there, and extending it
 * would assert a document that did not apply; under a `temporalUnique` index it could also overlap another owner.
 * Removed boundaries that follow a kept version are therefore replaced by one boundary without a document. Why not
 * HISTORY_UNAVAILABLE: a collection scan at that instant would fail for one pruned ID.
 * VERIFIED: tests/history-prune.test.ts reads the range before, inside and after a pruned slice, and verify() accepts
 * every pruned store there.
 *
 * Why a whole-collection call commits in batches: one transaction holds at most `maxTransactionOperations`
 * operations, and each removed version stages about four. Every batch leaves a store that verify() accepts, so an
 * interrupted call is repeated, not resumed from a stored cursor. Each batch is planned on a snapshot (planId) and
 * staged with point reads (applyPlans), so writers of other documents keep committing.
 */
import { DatabaseError } from './errors.js';
import { epoch } from './history-types.js';
import { documentPrefix, primary, range } from './keys.js';
import { transactionSchema } from './schema-cache.js';
import {
  auditPrefix,
  boundary,
  checkCoverage,
  deletedVersion,
  desc,
  asc,
  facts,
  forwards,
  heads,
  keyTime,
  suffix,
  touchHistory,
  type Fact,
} from './history-store.js';
import type { PrimaryKey, Reader, SnapshotLease, Writer } from './types.js';

const MAX_TIME = 8640000000000000;
type Signal = AbortSignal | undefined;

/** Which deleted documents pruneDeleted() removes. */
export interface PruneOptions {
  /** pruneHistory: versions that ended at or before this instant. pruneDeleted: documents deleted before it. */
  before?: Date;
  /** Only these documents. Default: the whole collection. */
  ids?: readonly PrimaryKey[];
  signal?: AbortSignal;
}
/** Which versions pruneHistory() removes. Default: every version that ended, of every document. */
export interface PruneHistoryOptions extends PruneOptions {
  /** Only versions that began at or after this instant: a slice of history. */
  from?: Date;
}
export interface PruneResult {
  /** Documents that lost a version; for pruneDeleted, documents removed. */
  documents: number;
  /** Effective versions removed, a period in which the document was deleted counting as one. */
  versions: number;
}
export interface PrunePlan {
  deleted: boolean;
  from: number;
  before: number;
  tokens?: string[];
}

export function prunePlan(options: PruneHistoryOptions = {}, deleted: boolean): PrunePlan {
  if (!options || typeof options !== 'object') throw new TypeError('Prune options are an object.');
  const before = options.before === undefined ? MAX_TIME : epoch(options.before);
  const from = options.from === undefined ? -MAX_TIME : epoch(options.from);
  if (deleted && options.from !== undefined)
    throw new TypeError('pruneDeleted removes whole documents; from applies to pruneHistory.');
  if (from >= before) throw new RangeError('from must precede before.');
  const ids = options.ids;
  if (ids !== undefined && (!Array.isArray(ids) || ids.length > 100_000))
    throw new RangeError('ids lists at most 100,000 IDs.');
  return {
    deleted,
    from,
    before,
    ...(ids ? { tokens: [...new Set(ids.map((id) => primary(id)))] } : {}),
  };
}

/** One staged change: a key with its value, or without one for a delete. */
type Operation = [key: string, value?: Fact | number];
/** What one transaction changes for one ID, computed on a reader. */
export interface IdPlan {
  token: string;
  /** Revision of the ID's head row when the plan was read; applyPlans() refuses a plan whose row moved on. */
  head: number | undefined;
  operations: Operation[];
  versions: number;
  /** The plan removes the ID's head row with everything else. */
  purged: boolean;
  /** false: the operation budget ended inside this ID; plan it again for the rest. */
  done: boolean;
}
const absent = (fact: Fact) => fact.document === null && !fact.image;
/** The only assertion of its boundary and without a document or an audit entry: it ends the version before it. */
const isGap = (fact: Fact) => fact.kind === 'resume' && absent(fact);
interface Group {
  time: number;
  rows: { key: string; fact: Fact }[];
}

/**
 * Plans the removal of the prunable versions of one ID, newest first. Stops once `budget` operations are planned;
 * `fresh` says the transaction holds nothing yet, and then the first version is removed whatever it costs.
 */
async function planVersions(
  reader: Reader,
  c: string,
  plan: PrunePlan,
  result: IdPlan,
  budget: number,
  fresh: boolean,
  spare: boolean,
): Promise<void> {
  const p = result.token,
    bounds = boundary(c, p),
    out = result.operations;
  // The version in effect at `before`: it and every later one stay.
  let kept: number | undefined;
  for await (const row of reader.scan({
    gte: bounds + desc(plan.before),
    lt: range(bounds).lt,
    limit: 1,
  }))
    kept = keyTime(row.key.slice(bounds.length));
  if (kept === undefined || plan.from >= kept) return;
  const keptTime = kept;
  // Two seeks answer for a document without an older version; only the others read their assertions.
  let older = false;
  for await (const _ of reader.scan({
    gte: bounds + desc(keptTime) + '\0',
    lt: bounds + desc(plan.from) + '\0',
    limit: 1,
  }))
    older = true;
  if (!older) return;
  const spared = spare
    ? ((await deletedVersion(reader, c, p))?.consulted.map((match) => match.fact.time) ?? [])
    : [];
  // Images that kept restorations point to. Assertions arrive newest first and an image is older than its pointer.
  const needed = new Set<string>();
  let newerKept = keptTime;
  // The oldest boundary removed so far in the current run. Its newest assertion and its two boundary rows are
  // decided when the run ends: removed, or kept as the boundary without a document that ends an older version.
  let tail: { time: number; key: string; fact: Fact; marker: boolean } | undefined;
  const planned = () => out.length + (tail ? 3 : 0);
  // The run ends at an older kept version (or at a version left for the next call), or at the oldest boundary.
  const close = (olderKept?: Fact) => {
    if (!tail) return;
    if (olderKept === undefined || absent(olderKept))
      out.push([tail.key], [bounds + desc(tail.time)], [forwards(c, p) + asc(tail.time)]);
    // In place, under the sequence of the assertion it replaces: a new sequence would read and advance the history
    // clock, and the prune would then conflict with every tracked writer.
    else if (!tail.marker)
      out.push([
        tail.key,
        {
          seq: tail.fact.seq,
          ord: tail.fact.ord,
          time: tail.time,
          end: newerKept,
          kind: 'resume',
          document: null,
        },
      ]);
    tail = undefined;
  };
  /** false: nothing older changes. */
  const settle = (group: Group): boolean => {
    const candidate = group.time < keptTime && group.time >= plan.from;
    const first = group.rows[0]!;
    if (
      !candidate ||
      spared.includes(group.time) ||
      group.rows.some((row) => needed.has(row.key))
    ) {
      close(first.fact);
      for (const { fact } of group.rows) if (fact.image) needed.add(fact.image);
      newerKept = group.time;
      return group.time >= plan.from;
    }
    const cost = group.rows.reduce((n, row) => n + (row.fact.kind === 'resume' ? 1 : 2), 2);
    if (planned() + cost > budget && (planned() > 0 || !fresh)) {
      // This version stays for the next call and ends the run like a kept one.
      close(first.fact);
      result.done = false;
      return false;
    }
    close();
    const marker = group.rows.length === 1 && isGap(first.fact);
    if (!marker) {
      for (const { key, fact } of group.rows) {
        if (key !== first.key) out.push([key]);
        if (fact.kind !== 'resume') out.push([auditPrefix(c, p) + suffix(fact)]);
      }
      result.versions++;
    }
    tail = { time: group.time, key: first.key, fact: first.fact, marker };
    return true;
  };
  const prefix = facts(c, p);
  let group: Group | undefined,
    reachedOldest = true;
  for await (const row of reader.scan(range(prefix))) {
    const time = keyTime(row.key.slice(prefix.length));
    if (group && group.time !== time && !settle(group)) {
      group = undefined;
      reachedOldest = false;
      break;
    }
    if (group?.time !== time) group = { time, rows: [] };
    group.rows.push({ key: row.key, fact: row.value as Fact });
  }
  if (group && !settle(group)) reachedOldest = false;
  // Nothing older than the run remains: no version ends there.
  if (reachedOldest) close();
}

/** Plans one ID: its ended versions, or for pruneDeleted() every record once its delete is older than `before`. */
export async function planId(
  reader: Reader,
  c: string,
  plan: PrunePlan,
  token: string,
  budget: number,
  fresh: boolean,
): Promise<IdPlan> {
  const head = await reader.get(heads(c) + token);
  const result: IdPlan = {
    token,
    head: head.revision,
    operations: [],
    versions: 0,
    purged: false,
    done: true,
  };
  if (!plan.deleted) {
    await planVersions(reader, c, plan, result, budget, fresh, true);
    return result;
  }
  if (
    !head.found ||
    (head.value as number) >= plan.before ||
    (await reader.get(documentPrefix(c) + token)).found
  )
    return result;
  // Four rows per version. A document with more than one transaction holds loses its versions first, over
  // several transactions that each leave a valid timeline.
  let boundaries = 0;
  for await (const _ of reader.scan(range(boundary(c, token)))) boundaries++;
  if (boundaries * 4 + 1 > budget) {
    const all = { deleted: true, from: -MAX_TIME, before: MAX_TIME };
    await planVersions(reader, c, all, result, budget, fresh, false);
    // Without a removable version left, the rest goes in one transaction of its own.
    if (!result.done || result.operations.length || !fresh) return { ...result, done: false };
  }
  // A boundary that only ends a version, left by an earlier batch or a bounded write, is not a version.
  let time: number | undefined, alone: Fact | undefined;
  const count = () => {
    if (time !== undefined && !(alone && isGap(alone))) result.versions++;
  };
  for await (const row of reader.scan(range(facts(c, token)))) {
    const at = keyTime(row.key.slice(facts(c, token).length));
    if (at !== time) count();
    alone = at === time ? undefined : (row.value as Fact);
    time = at;
    result.operations.push([row.key]);
  }
  count();
  for (const prefix of [auditPrefix(c, token), forwards(c, token), boundary(c, token)])
    for await (const row of reader.scan(range(prefix))) result.operations.push([row.key]);
  result.operations.push([heads(c) + token]);
  result.purged = true;
  return result;
}

/**
 * Stages plans in a transaction with point reads only, so the commit conflicts with a writer of a planned ID and
 * with no other: a scan in a DBSONL transaction conflicts with every concurrent commit. `pinned` plans were read on
 * an earlier snapshot; one whose head row moved since is returned as stale, not staged. Every history write of an
 * ID rewrites its head row (assertChange(), seedAt(), an archive import, and this function), so an unmoved row
 * means the ID's assertions are the planned ones.
 * VERIFIED: tests/history-prune.test.ts prunes 120 documents while each is updated; node_modules/defuss-dbsonl
 * README: "after a scan, any concurrent commit does".
 */
export async function applyPlans(
  tx: Writer,
  c: string,
  plans: readonly IdPlan[],
  pinned: boolean,
): Promise<{ touched: string[]; versions: number; stale: string[] }> {
  checkCoverage((await transactionSchema(tx, c)).schema);
  const touched: string[] = [],
    stale: string[] = [];
  let versions = 0,
    staged = false;
  for (const plan of plans) {
    if (!plan.operations.length) continue;
    const key = heads(c) + plan.token,
      head = await tx.get(key);
    if (pinned && head.revision !== plan.head) {
      stale.push(plan.token);
      continue;
    }
    for (const [target, value] of plan.operations)
      if (value === undefined) tx.delete(target);
      else tx.put(target, value);
    if (!plan.purged) tx.put(key, head.value);
    staged = true;
    versions += plan.versions;
    if (plan.versions) touched.push(plan.token);
  }
  // Also when only a boundary without a document changed: historical caches are keyed by this generation.
  if (staged) touchHistory(tx, c);
  return { touched, versions, stale };
}

/** IDs with a version pruneHistory() may remove, in key order, from the boundary rows alone. */
async function* historyCandidates(
  reader: Reader,
  c: string,
  plan: PrunePlan,
  after: string | undefined,
  signal: Signal,
): AsyncGenerator<string> {
  const prefix = 'b:' + c + ':';
  let token: string | undefined,
    keptSeen = false,
    listed = false;
  for await (const row of reader.scan({ gte: after ?? prefix, lt: range(prefix).lt, signal })) {
    const split = row.key.indexOf('!', prefix.length),
      p = row.key.slice(prefix.length, split);
    if (p !== token) {
      token = p;
      keptSeen = listed = false;
    }
    if (listed) continue;
    // Newest first: the first boundary at or before `before` stays, an older one from `from` on is removable.
    const time = keyTime(row.key.slice(split + 1));
    if (!keptSeen) keptSeen = time <= plan.before;
    else if (time >= plan.from) {
      listed = true;
      yield p;
    }
  }
}
/** IDs whose newest boundary is older than `before` and that hold no live document. */
async function* deletedCandidates(
  reader: Reader,
  c: string,
  plan: PrunePlan,
  after: string | undefined,
  signal: Signal,
): AsyncGenerator<string> {
  const prefix = heads(c);
  for await (const row of reader.scan({ gte: after ?? prefix, lt: range(prefix).lt, signal })) {
    const p = row.key.slice(prefix.length);
    if ((row.value as number) < plan.before && !(await reader.get(documentPrefix(c) + p)).found)
      yield p;
  }
}
/**
 * The IDs to prune, in pages: the named ones, else those a scan finds. Each page reads its own lease, so a
 * whole-collection prune holds no snapshot open across its commits.
 */
export async function* prunePages(
  open: () => Promise<SnapshotLease>,
  c: string,
  plan: PrunePlan,
  signal?: Signal,
  size = 64,
): AsyncGenerator<string[]> {
  if (plan.tokens) {
    for (let i = 0; i < plan.tokens.length; i += size) yield plan.tokens.slice(i, i + size);
    return;
  }
  let after: string | undefined;
  for (;;) {
    signal?.throwIfAborted();
    const page: string[] = [];
    const lease = await open();
    try {
      const found = plan.deleted
        ? deletedCandidates(lease.reader, c, plan, after, signal)
        : historyCandidates(lease.reader, c, plan, after, signal);
      for await (const p of found) if (page.push(p) === size) break;
    } finally {
      await lease.close();
    }
    if (!page.length) return;
    const last = page[page.length - 1]!;
    after = plan.deleted ? heads(c) + last + '\0' : range(boundary(c, last)).lt;
    yield page;
    if (page.length < size) return;
  }
}
/** Refuses a prune on a dated view: it removes recorded history, whatever date the view reads. */
export function liveOnly(historic: boolean): void {
  if (historic)
    throw new DatabaseError(
      'HISTORY_READ_ONLY',
      'Pruning runs on the live collection, not at(date).',
    );
}
