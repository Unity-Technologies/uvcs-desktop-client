/**
 * The operations changing a workspace (`OperationTracker.run`) that each window started, by `BrowserWindow.id`, so
 * closing a window can wait for its own (`ClosingWithWrites`) while other windows' go on.
 */
export class WindowWrites {
  private readonly running = new Map<number, Set<Promise<unknown>>>();

  /** An operation started from the window; it counts until `finished` settles, whether it succeeds or fails. */
  started(windowId: number, finished: Promise<unknown>): void {
    const writes = this.running.get(windowId) ?? new Set();
    writes.add(finished);
    this.running.set(windowId, writes);
    const forget = (): void => {
      writes.delete(finished);
      if (writes.size === 0 && this.running.get(windowId) === writes) this.running.delete(windowId);
    };
    finished.then(forget, forget);
  }

  /** Whether an operation started from any of the windows runs. */
  runningIn(windowIds: readonly number[]): boolean {
    return windowIds.some((windowId) => this.running.has(windowId));
  }

  /** Settles once none of the windows' operations runs, including any started while waiting; at once when none does. */
  async finishedIn(windowIds: readonly number[]): Promise<void> {
    while (this.runningIn(windowIds)) await Promise.allSettled(windowIds.flatMap((windowId) => [...(this.running.get(windowId) ?? [])]));
  }
}
