import { temporalContext } from './history-view.js';
import { listHistory, resolveBasis } from './history-store.js';
import {
  timeScope,
  recorded,
  type TimeScope,
  type HistoryReadOptions,
  type HistoryListOptions,
  type HistorySegment,
  type HistoryChange,
} from './history-types.js';
import type { Sort } from './ordered-access.js';
import { indexPage, countIndexRange } from './index-page.js';
import type { IndexPageOptions, IndexCountOptions, IndexPage } from './types.js';
import { cacheDescriptor, cachedEvaluate } from './query-cache.js';
import { searchDocuments } from './search.js';
import type { DocumentSearchQuery, SearchRequest, SearchIndexDefinition } from './search-types.js';
import { readKeys } from './reads.js';
import { forRows } from 'defuss-dataview/compute';
import type {
  AggregateDescriptor,
  AggregateOutput,
  ComputeEvent,
  ComputeOptions,
  ComputeResult,
  Expr,
  Page,
  PreparedCompute,
  RowsDescriptor,
  RowsOutput,
  ViewDescriptor,
  TotalsOutput,
  ViewResult,
} from 'defuss-dataview/compute';
import { compileQuery } from 'defuss-dataview/query';
import { estimateRowBytes } from 'defuss-dataview/stream';
import { measuredQueue } from './measured.js';
import { parallelAggregate, preparePartials } from './parallel.js';
import type { PreparedPartials } from './parallel.js';
import type { RecordSource } from 'defuss-dataview/stream';
import { createSource, createDocumentSource, planAccess, capturedSelection } from './source.js';
import type { StoredRow } from './source.js';
import type {
  Document,
  FindRequest,
  PrimaryKey,
  QueryOptions,
  ReadContext,
  Selection,
  IndexDefinition,
} from './types.js';
import { documentKey, primary, readSchema, schemaKey } from './keys.js';

/** Prepared descriptors retain DataView's inferred aliases and nullable aggregate types. */
export interface BoundQuery<T extends Document, R, X = never> {
  evaluate(
    page?: Page,
    options?: QueryOptions<T>,
  ): Promise<[X] extends [never] ? ComputeResult<R> : ViewResult<R, X>>;
  stream(page?: Page, options?: QueryOptions<T>): AsyncGenerator<ComputeEvent<R, X>>;
  explain(): ReturnType<PreparedCompute<T, R, X>['explain']>;
}
type Node = { v: 1; op: string; key?: string; path?: string; args?: Expr<unknown>[] };
/** Only validated AST structure is visited; a literal's graph (possibly cyclic) is deliberately opaque. */
function lift<V>(expression: Expr<V>): Expr<V> {
  const node = expression as unknown as Node;
  if (node.op === 'field')
    return { v: 1, op: 'path', path: `value.${node.key}` } as unknown as Expr<V>;
  if (node.op === 'path') return { ...node, path: `value.${node.path}` } as unknown as Expr<V>;
  return node.args ? ({ ...node, args: node.args.map(lift) } as unknown as Expr<V>) : expression;
}
function base<D extends Selection>(descriptor: D) {
  return {
    ...descriptor,
    ...(descriptor.filters === undefined
      ? {}
      : {
          filters: descriptor.filters.map((filter) => ({
            ...filter,
            field: `value.${filter.field}`,
          })),
        }),
    ...(descriptor.where === undefined ? {} : { where: lift(descriptor.where) }),
  };
}
function options<T extends Document>(
  input?: QueryOptions<T>,
): ComputeOptions<StoredRow<T>> | undefined {
  return (
    input &&
    ({
      ...input,
      ...(input.sizeOf ? { sizeOf: (row: StoredRow<T>) => input.sizeOf!(row.value) } : {}),
    } as ComputeOptions<StoredRow<T>> | undefined)
  );
}
function bind<T extends Document, R, X = never>(
  plan: PreparedCompute<StoredRow<T>, R, X>,
  source: RecordSource<StoredRow<T>>,
): BoundQuery<T, R, X> {
  return {
    evaluate: (page, input) => plan.evaluate(source, page, options(input)),
    stream: (page, input) => plan.stream(source, page, options(input)),
    explain: () => plan.explain(),
  };
}
/** Compile original document descriptors once; no lifted duplicate plan for projections/aggregations. */
/**
 * Binds a document plan to a collection. Aggregates DataView can merge first try the query workers; when those decline
 * (no workers, a small collection, an index-narrowed plan or a failed worker), the plan runs here in one thread.
 */
function bindDocuments<T extends Document, R, X = never>(
  plan: PreparedCompute<T, R, X>,
  context: ReadContext,
  collection: string,
  selection: Selection,
  key?: string,
  sorters?: readonly Sort[],
  partials?: PreparedPartials<T, R>,
): BoundQuery<T, R, X> {
  const captured = { ...capturedSelection(selection), sorters };
  const source = createDocumentSource<T>(context, collection, captured);
  return {
    evaluate: (page, input) =>
      cachedEvaluate(
        readAt(context, collection, input),
        collection,
        key,
        page,
        input,
        async (borrowed, stablePage, stableInput) =>
          ((partials &&
            (await parallelAggregate(
              partials,
              borrowed,
              collection,
              captured,
              stablePage,
              stableInput,
            ))) as Awaited<ReturnType<PreparedCompute<T, R, X>['evaluate']>> | undefined) ??
          plan.evaluate(
            borrowed === context ? source : createDocumentSource<T>(borrowed, collection, captured),
            stablePage,
            measuredOptions(stableInput),
          ),
      ),
    stream: (page, input) =>
      plan.stream(
        hasTime(input)
          ? createDocumentSource<T>(readAt(context, collection, input), collection, captured)
          : source,
        page,
        measuredOptions(input),
      ),
    explain: () => plan.explain(),
  };
}
/**
 * The native provider and DataView both enforce byte bounds, so each scanned row is measured by the source and
 * again by DataView, in the same order. VERIFIED: a WeakMap memo for that second call took about 7% of a warm
 * 100,000-document aggregate; a queue of the source's measurements answers it with one identity check.
 */
function measuredOptions<T extends Document>(input?: QueryOptions<T>): QueryOptions<T> {
  const measure = input?.sizeOf ?? estimateRowBytes;
  return { ...input, sizeOf: measuredQueue(measure) };
}
function hasTime(input?: HistoryReadOptions) {
  return input?.$historic !== undefined || input?.$asOfRevision !== undefined;
}
function readAt(ctx: ReadContext, c: string, input?: HistoryReadOptions) {
  if (!hasTime(input)) return ctx;
  const scope = timeScope(input, ctx.temporalScope)!;
  return temporalContext(ctx.temporalParent ?? ctx, c, scope);
}
/** Read operations shared by live collections, explicit snapshots and transactions. */
export class ReadCollection<T extends Document = Document> {
  readonly q = forRows<T>();
  constructor(
    readonly name: string,
    protected readonly rawContext: ReadContext,
    protected readonly period?: TimeScope,
  ) {
    this.context = period ? temporalContext(rawContext, name, period) : rawContext;
  }
  protected readonly context: ReadContext;
  /** Whether this view reads the collection as it was at a date (`at(date)`), not as it is now. */
  get historic(): boolean {
    return this.period !== undefined;
  }
  at(date: Date, options: Omit<HistoryReadOptions, '$historic'> = {}): ReadCollection<T> {
    return new ReadCollection<T>(
      this.name,
      this.rawContext,
      timeScope({ ...options, $historic: date }, this.period),
    );
  }
  history(id: PrimaryKey, options: HistoryListOptions = {}): Promise<HistorySegment<T>[]> {
    return this.list(id, options, false) as Promise<HistorySegment<T>[]>;
  }
  audit(id: PrimaryKey, options: HistoryListOptions = {}): Promise<HistoryChange<T>[]> {
    return this.list(id, options, true) as Promise<HistoryChange<T>[]>;
  }
  private async list(id: PrimaryKey, options: HistoryListOptions, audit: boolean) {
    const token = primary(id),
      cut = this.period
        ? timeScope({ $asOfRevision: options.$asOfRevision }, this.period)?.cutoff
        : recorded(options.$asOfRevision);
    const stable = { ...options };
    this.rawContext.check();
    const lease = await this.rawContext.open();
    try {
      return await listHistory<T>(
        lease.reader,
        this.name,
        token,
        await resolveBasis(lease.reader, cut),
        audit,
        stable,
      );
    } finally {
      await lease.close();
    }
  }
  private cacheEnabled(input?: QueryOptions<T>, selection?: Selection): boolean {
    const cache = this.context.queryCache;
    if (!cache) return false;
    const use = input?.cache ?? (cache.options.mode === 'auto' ? 'auto' : false);
    // Primary equality produces at most one candidate. Keying/coalescing cannot meet automatic admission.
    // Profiling should execute the plan; explicit true/refresh can still request cached summaries.
    if (
      use === 'auto' &&
      (input?.profile ||
        (selection?.access !== 'scan' &&
          selection?.filters?.some((filter) => filter.field === 'id' && filter.op === 'eq')))
    )
      return false;
    return use !== false;
  }
  private memo<P>(
    kind: string,
    descriptor: unknown,
    enabled: boolean,
    build: (key?: string) => P,
  ): P {
    this.context.check();
    const cache = this.context.queryCache;
    const key =
      enabled && cache
        ? cacheDescriptor({ kind, descriptor }, cache.options.maxKeyBytes)
        : undefined;
    if (!key || !cache || !this.context.cachePlans) return build(key);
    return cache.plan(`${this.name}:${key}`, () => Object.freeze(build(key)) as P);
  }
  /** Resume directly at the previous index key. Same-collection writes invalidate a live continuation. */
  pageByIndex(index: string, options?: IndexPageOptions): Promise<IndexPage<T>> {
    return indexPage<T>(readAt(this.context, this.name, options), this.name, index, options);
  }
  /** Read typed IDs from ordered index entries. The cursor can also resume a document page. */
  pageIdsByIndex(index: string, options?: IndexPageOptions): Promise<IndexPage<T['id']>> {
    return indexPage<T>(readAt(this.context, this.name, options), this.name, index, options, true);
  }
  /** Exact cardinality of a physical sort-key interval in one snapshot. */
  countByIndex(index: string, options?: IndexCountOptions): Promise<number> {
    return countIndexRange(readAt(this.context, this.name, options), this.name, index, options);
  }
  async get(id: PrimaryKey, options?: HistoryReadOptions): Promise<T | undefined> {
    this.context.check();
    const result = await readAt(this.context, this.name, options).get(documentKey(this.name, id));
    return result.found ? (result.value as T) : undefined;
  }
  /** Bounded parallel lookup in one snapshot, preserving order and duplicates. */
  async getMany(
    ids: readonly PrimaryKey[],
    options: { signal?: AbortSignal } & HistoryReadOptions = {},
  ): Promise<(T | undefined)[]> {
    if (!Array.isArray(ids) || ids.length > 100_000)
      throw new RangeError('getMany accepts at most 100,000 IDs.');
    const signal = options.signal;
    const keys = ids.map((id) => documentKey(this.name, id));
    this.context.check();
    const lease = await readAt(this.context, this.name, options).open();
    try {
      return (await readKeys(lease.reader, keys, signal)).map((item) =>
        item.found ? (item.value as T) : undefined,
      );
    } finally {
      await lease.close();
    }
  }
  async searchIndexes(options?: HistoryReadOptions): Promise<SearchIndexDefinition[]> {
    return readSchema(
      (await readAt(this.context, this.name, options).get(schemaKey(this.name))).value,
    ).searchIndexes;
  }
  search(index: string, query: DocumentSearchQuery, options?: SearchRequest) {
    return searchDocuments<T>(
      readAt(this.context, this.name, options),
      this.name,
      index,
      query,
      options,
    );
  }
  async has(id: PrimaryKey, options?: HistoryReadOptions): Promise<boolean> {
    return (await this.get(id, options)) !== undefined;
  }
  /** Direct DataView interoperability. Each open obtains a fresh snapshot, unless bound to an explicit snapshot/transaction. */
  source(options?: HistoryReadOptions): RecordSource<T> {
    return createDocumentSource<T>(readAt(this.context, this.name, options), this.name);
  }
  async indexes(options?: HistoryReadOptions): Promise<IndexDefinition[]> {
    return readSchema(
      (await readAt(this.context, this.name, options).get(schemaKey(this.name))).value,
    ).indexes;
  }
  async explain(request: FindRequest = {}) {
    const ctx = readAt(this.context, this.name, request);
    const prepared = this.prepareFind(request, false); // Validate once before opening storage.
    const selection = {
      ...capturedSelection(request),
      sorters: compileQuery({ sorters: request.sorters }).ordering.sorters,
    };
    const lease = await ctx.open();
    try {
      return {
        ...(lease.reader.temporal
          ? {
              history: {
                effective: new Date(ctx.temporalScope!.time),
                recordedRevision: lease.reader.revision,
                secondaryIndexes: 'built on demand',
              },
            }
          : {}),
        revision: lease.reader.revision,
        access: (await planAccess(lease.reader, this.name, selection)).public,
        query: prepared.explain(),
      };
    } finally {
      await lease.close();
    }
  }
  prepareFind(request: FindRequest = {}, cacheKey = true): BoundQuery<T, T> {
    if (hasTime(request)) {
      const { $historic, $asOfRevision, ...rest } = request;
      return new ReadCollection<T>(
        this.name,
        this.rawContext,
        timeScope({ $historic, $asOfRevision }, this.period),
      ).prepareFind(rest, cacheKey);
    }
    return this.memo('find', request, cacheKey, (key) => this.buildFind(request, key));
  }
  private buildFind(request: FindRequest, key?: string): BoundQuery<T, T> {
    const { offset: _offset, limit: _limit, access: _access, sorters, ...selection } = request;
    const ordering = compileQuery({
      filters: selection.filters,
      sorters,
      semantics: selection.semantics,
    }).ordering.sorters;
    // Scalar filters/sorters are already validated above. Arbitrary expression ASTs still require original-path
    // validation before lifting; prefixed paths alone could accidentally make an invalid field() acceptable.
    if (selection.where !== undefined)
      this.q.rows({
        ...selection,
        select: { row: this.q.literal(null) },
        orderBy: ordering.map((sorter) => ({
          expr: this.q.path(sorter.field),
          direction: sorter.direction,
        })),
      });
    const q = forRows<StoredRow<T>>();
    const plan = q.rows({
      ...base(selection),
      select: { row: q.field('value') },
      orderBy: ordering.map((sorter) => ({
        expr: q.path(`value.${sorter.field}`),
        direction: sorter.direction,
      })),
    });
    // Capture the access descriptors with the same value semantics as DataView (Dates/buffers are cloned).
    const selectionCopy = { ...capturedSelection(request), sorters: ordering };
    const source = createSource<T>(this.context, this.name, selectionCopy);
    const context = this.context,
      collection = this.name;
    const bound = bind(plan, source);
    const page = { offset: request.offset, limit: request.limit };
    const outputOptions = (input?: QueryOptions<T>): QueryOptions<T> | undefined =>
      input?.sizeOfOutput
        ? { ...input, sizeOfOutput: (output) => input.sizeOfOutput!((output as { row: T }).row) }
        : input;
    return {
      async evaluate(override, input) {
        const result = await cachedEvaluate(
          readAt(context, collection, input),
          collection,
          key,
          override ?? page,
          input,
          (borrowed, stablePage, stableInput) =>
            (borrowed === context
              ? bound
              : bind(plan, createSource<T>(borrowed, collection, selectionCopy))
            ).evaluate(stablePage, outputOptions(stableInput)),
        );
        return { ...result, rows: result.rows.map((item) => item.row) };
      },
      stream(override, input) {
        // Capture the temporal basis at the public call. The iterator opens storage on demand.
        const ctx = readAt(context, collection, input);
        const query =
          ctx === context ? bound : bind(plan, createSource<T>(ctx, collection, selectionCopy));
        const events = query.stream(override ?? page, outputOptions(input));
        return (async function* () {
          for await (const event of events)
            yield event.type === 'batch'
              ? { ...event, rows: event.rows.map((item) => item.row) }
              : event;
        })();
      },
      explain: bound.explain,
    };
  }
  query(request: FindRequest = {}, input?: QueryOptions<T>): Promise<ComputeResult<T>> {
    return this.prepareFind(request, this.cacheEnabled(input, request)).evaluate(undefined, input);
  }
  async find(request: FindRequest = {}, input?: QueryOptions<T>): Promise<T[]> {
    return (await this.query(request, input)).rows;
  }
  async findOne(request: FindRequest = {}, input?: QueryOptions<T>): Promise<T | undefined> {
    return (await this.find({ ...request, limit: 1 }, input))[0];
  }
  stream(request: FindRequest = {}, input?: QueryOptions<T>): AsyncGenerator<ComputeEvent<T>> {
    return this.prepareFind(request, false).stream(undefined, input);
  }
  async count(selection: Selection = {}, input?: QueryOptions<T>): Promise<number> {
    if (hasTime(selection)) {
      const { $historic, $asOfRevision, ...rest } = selection;
      return new ReadCollection<T>(
        this.name,
        this.rawContext,
        timeScope({ $historic, $asOfRevision }, this.period),
      ).count(rest, input);
    }
    const plan = this.memo('count', selection, this.cacheEnabled(input, selection), (key) => {
      const { access: _access, ...rest } = selection;
      const descriptor = { ...rest, measures: { count: this.q.count() } };
      const plan = this.q.aggregate(descriptor);
      return bindDocuments(
        plan,
        this.context,
        this.name,
        selection,
        key,
        undefined,
        this.context.parallel && preparePartials(plan, descriptor),
      );
    });
    const result = await plan.evaluate(undefined, input);
    return result.rows[0]!.count;
  }
  prepareSelect<const D extends RowsDescriptor>(
    descriptor: D,
    cacheKey = true,
  ): BoundQuery<T, RowsOutput<D>> {
    return this.memo('select', descriptor, cacheKey, (key) =>
      bindDocuments(
        this.q.rows(descriptor),
        this.context,
        this.name,
        descriptor,
        key,
        projectedOrder(descriptor),
      ),
    );
  }
  select<const D extends RowsDescriptor>(
    descriptor: D,
    page?: Page,
    input?: QueryOptions<T>,
  ): Promise<ComputeResult<RowsOutput<D>>> {
    return this.prepareSelect(descriptor, this.cacheEnabled(input, descriptor)).evaluate(
      page,
      input,
    );
  }
  prepareAggregate<const D extends AggregateDescriptor>(
    descriptor: D,
    cacheKey = true,
  ): BoundQuery<T, AggregateOutput<D>> {
    return this.memo('aggregate', descriptor, cacheKey, (key) => {
      const plan = this.q.aggregate(descriptor);
      return bindDocuments(
        plan,
        this.context,
        this.name,
        descriptor,
        key,
        undefined,
        this.context.parallel && preparePartials(plan, descriptor),
      );
    });
  }
  aggregate<const D extends AggregateDescriptor>(
    descriptor: D,
    page?: Page,
    input?: QueryOptions<T>,
  ): Promise<ComputeResult<AggregateOutput<D>>> {
    return this.prepareAggregate(descriptor, this.cacheEnabled(input, descriptor)).evaluate(
      page,
      input,
    );
  }
  prepareView<const D extends ViewDescriptor>(
    descriptor: D,
    cacheKey = true,
  ): BoundQuery<T, RowsOutput<D>, TotalsOutput<D>> {
    return this.memo('view', descriptor, cacheKey, (key) =>
      bindDocuments(this.q.view(descriptor), this.context, this.name, descriptor, key),
    );
  }
  view<const D extends ViewDescriptor>(
    descriptor: D,
    page?: Page,
    input?: QueryOptions<T>,
  ): Promise<ViewResult<RowsOutput<D>, TotalsOutput<D>>> {
    return this.prepareView(descriptor, this.cacheEnabled(input, descriptor)).evaluate(
      page,
      input,
    ) as Promise<ViewResult<RowsOutput<D>, TotalsOutput<D>>>;
  }
}

function projectedOrder(descriptor: RowsDescriptor): Sort[] | undefined {
  const sorters: Sort[] = [];
  for (const sort of descriptor.orderBy ?? []) {
    const node = sort.expr as unknown as Node;
    const field = node.op === 'field' ? node.key : node.op === 'path' ? node.path : undefined;
    if (!field) return undefined;
    sorters.push({ field, direction: sort.direction ?? 'asc' });
  }
  return sorters;
}
