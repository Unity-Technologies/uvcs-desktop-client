/**
 * The searches running, one per owner (a window's repository): a new one aborts the one before it, whose answer no one
 * waits for any more (`IssueTrackers.searchIssues`). Its request stops where it is (`TrackerRequest.signal`).
 */
export class SupersededSearches {
  private readonly running = new Map<string, AbortController>();

  /** A search starts for `owner`: the one it had running is aborted. */
  start(owner: string): AbortSignal {
    this.running.get(owner)?.abort();
    const controller = new AbortController();
    this.running.set(owner, controller);
    return controller.signal;
  }

  /** A search ended: forgotten, unless a newer one took its place. */
  finish(owner: string, signal: AbortSignal): void {
    if (this.running.get(owner)?.signal === signal) this.running.delete(owner);
  }

  /** How many owners have a search running. */
  get size(): number {
    return this.running.size;
  }
}
