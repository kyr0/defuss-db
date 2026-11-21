const QUEUE = Symbol('defuss-db.measuredQueue');
type Measure<T> = (row: T) => number;
type QueuedMeasure<T> = Measure<T> & { [QUEUE]?: Measure<T> };
// A batch holds at most a few thousand rows; more pending entries mean DataView stopped asking.
const MAX_PENDING = 8192;

/**
 * DataView's entry measures a row unless it is the next one the source already measured. VERIFIED: rows reach
 * DataView in the order the source measured them (two calls per row in aggregate and sorted scans), so one identity check replaces a hash lookup; any other row is
 * measured directly, which keeps the result identical to calling `measure` every time.
 */
export function measuredQueue<T>(measure: Measure<T>): Measure<T> {
  const rows: (T | undefined)[] = [],
    sizes: number[] = [];
  let head = 0;
  const sizeOf: QueuedMeasure<T> = (row) => {
    if (head === rows.length || rows[head] !== row) return measure(row);
    const size = sizes[head]!;
    rows[head++] = undefined;
    if (head === rows.length) rows.length = sizes.length = head = 0;
    return size;
  };
  sizeOf[QUEUE] = (row) => {
    const size = measure(row);
    if (rows.length - head >= MAX_PENDING) rows.length = sizes.length = head = 0;
    rows.push(row);
    sizes.push(size);
    return size;
  };
  return sizeOf;
}

/** The source's entry: measures and queues the size when the request came from measuredQueue(). */
export function sourceMeasure<T>(sizeOf: Measure<T>): Measure<T> {
  return (sizeOf as QueuedMeasure<T>)[QUEUE] ?? sizeOf;
}
