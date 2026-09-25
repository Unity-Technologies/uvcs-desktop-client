export interface OperationContext {
  signal: AbortSignal;
  reportProgress: (line: string) => void;
}

type ProgressListener = (operationId: string, line: string) => void;
type StartListener = (finished: Promise<unknown>) => void;

/** Tracks long-running operations so they can report progress and be cancelled from the UI. */
export class OperationTracker {
  private readonly running = new Map<string, AbortController>();

  constructor(
    private readonly onProgress: ProgressListener,
    private readonly onStarted: StartListener,
  ) {}

  /** Runs an operation that changes the workspace (update, switch, checkin…). */
  run<T>(operationId: string, work: (context: OperationContext) => Promise<T>): Promise<T> {
    return this.track(operationId, work, true);
  }

  /** Runs a slow read that the UI may cancel; the workspace watcher keeps reporting changes meanwhile. */
  read<T>(operationId: string, work: (context: OperationContext) => Promise<T>): Promise<T> {
    return this.track(operationId, work, false);
  }

  private async track<T>(operationId: string, work: (context: OperationContext) => Promise<T>, writes: boolean): Promise<T> {
    const controller = new AbortController();
    this.running.set(operationId, controller);
    try {
      const finished = work({
        signal: controller.signal,
        reportProgress: (line) => this.onProgress(operationId, line),
      });
      if (writes) this.onStarted(finished);
      return await finished;
    } finally {
      this.running.delete(operationId);
    }
  }

  cancel(operationId: string): void {
    this.running.get(operationId)?.abort();
  }
}
