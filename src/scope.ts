import { DatabaseError } from './errors.js';
/** One transaction is sequential. A failed write poisons it even if user code catches the failure. */
export class TransactionScope {
  private active = true;
  private busy = false;
  private cursorId?: string;
  private mutation = 0;
  cursorIdentity(): string {
    this.cursorId ??= globalThis.crypto.randomUUID();
    return 'tx-' + this.cursorId;
  }
  private failure: { error: unknown } | undefined;
  private pending = new Set<Promise<unknown>>();
  get writeSequence(): number {
    return this.mutation;
  }
  check(): void {
    if (!this.active) throw new DatabaseError('CLOSED', 'Transaction has ended.');
  }
  enter(): () => void {
    this.check();
    if (this.busy)
      throw new DatabaseError(
        'BUSY',
        'Await each transaction operation and close its streams before starting another.',
      );
    this.busy = true;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.busy = false;
      }
    };
  }
  run<R>(write: boolean, fn: () => Promise<R>): Promise<R> {
    let release: () => void;
    try {
      release = this.enter();
    } catch (error) {
      return Promise.reject(error);
    }
    if (write) this.mutation++;
    const result = Promise.resolve()
      .then(fn)
      .catch((error) => {
        if (write) this.failure = { error };
        throw error;
      })
      .finally(() => {
        release();
        this.pending.delete(result);
      });
    this.pending.add(result);
    // Observe unawaited failures while keeping the original promise rejected for its caller.
    void result.catch(() => {});
    return result;
  }
  async finish(): Promise<void> {
    const unfinished = this.busy;
    // Close admission before draining: an operation started after the callback returned would otherwise be
    // admitted while finish() waits, and its staged writes would commit even when it fails. VERIFIED: tests/database.test.ts
    // commits half of a failed insertMany without this line.
    this.active = false;
    await Promise.allSettled(this.pending);
    if (this.failure) throw this.failure.error;
    if (unfinished)
      throw new DatabaseError(
        'UNFINISHED_TRANSACTION',
        'Transaction callback returned with an unfinished operation or stream.',
      );
  }
  async deactivate(): Promise<void> {
    this.active = false;
    await Promise.allSettled(this.pending);
  }
}
