/** At most ten updates a second: enough for a smooth bar, few enough to keep IPC and React quiet. */
export const PROGRESS_INTERVAL_MS = 100;

/**
 * Passes on the latest value at most once per interval, the last one always, and urgent ones (a new stage) at once.
 * `cm` rewrites its progress every 200 ms, but a merge prints thousands of records in a burst.
 */
export class ProgressThrottle<T> {
  private lastEmit = Number.NEGATIVE_INFINITY;
  private pending: { value: T } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly emit: (value: T) => void,
    private readonly intervalMs = PROGRESS_INTERVAL_MS,
  ) {}

  push(value: T, urgent = false): void {
    this.pending = { value };
    const wait = this.lastEmit + this.intervalMs - Date.now();
    if (urgent || wait <= 0) this.flush();
    else this.timer ??= setTimeout(() => this.flush(), wait);
  }

  /** Sends what's pending now, e.g. the last value before the operation ends. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return;
    const { value } = this.pending;
    this.pending = null;
    this.lastEmit = Date.now();
    this.emit(value);
  }
}
