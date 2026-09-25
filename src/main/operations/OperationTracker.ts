export interface OperationContext {
  signal: AbortSignal;
  reportProgress: (line: string) => void;
}

type ProgressListener = (operationId: string, line: string) => void;

/** Tracks long-running operations so they can report progress and be cancelled from the UI. */
export class OperationTracker {
  private readonly running = new Map<string, AbortController>();

  constructor(private readonly onProgress: ProgressListener) {}

  async run<T>(operationId: string, work: (context: OperationContext) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.running.set(operationId, controller);
    try {
      return await work({
        signal: controller.signal,
        reportProgress: (line) => this.onProgress(operationId, line),
      });
    } finally {
      this.running.delete(operationId);
    }
  }

  cancel(operationId: string): void {
    this.running.get(operationId)?.abort();
  }
}
