import type { IssueRead } from '@shared/domain/issueTrackers';

/** Reads issues of one connection, one request for all of them (`issueTrackers.readIssues`). */
export type ReadIssues = (connectionId: string, keys: string[]) => Promise<IssueRead[]>;

/** Runs `flush` once the current task is done: every chip drawn in it has asked by then. */
export type ScheduleFlush = (flush: () => void) => void;

const nextTask: ScheduleFlush = (flush) => {
  setTimeout(flush, 0);
};

interface Waiting {
  resolve: (read: IssueRead) => void;
  reject: (error: unknown) => void;
}

/**
 * Gathers the issues asked in the same task (every chip of a comment, of a list drawn at once) and reads them in one
 * request per connection (docs/features/issue-trackers.md, "Batched"). The request belongs to no one query: a query
 * cancelled meanwhile doesn't abort it, and its answer fills every one that asked. A key asked twice is read once.
 */
export class IssueReadBatch {
  private readonly waiting = new Map<string, Map<string, Waiting[]>>();
  private scheduled = false;

  constructor(
    private readonly readIssues: ReadIssues,
    private readonly schedule: ScheduleFlush = nextTask,
  ) {}

  read(connectionId: string, key: string): Promise<IssueRead> {
    return new Promise((resolve, reject) => {
      const keys = this.waiting.get(connectionId) ?? new Map<string, Waiting[]>();
      keys.set(key, [...(keys.get(key) ?? []), { resolve, reject }]);
      this.waiting.set(connectionId, keys);
      if (this.scheduled) return;
      this.scheduled = true;
      this.schedule(() => this.flush());
    });
  }

  private flush(): void {
    this.scheduled = false;
    const batches = [...this.waiting];
    this.waiting.clear();
    for (const [connectionId, keys] of batches) void this.readBatch(connectionId, keys);
  }

  private async readBatch(connectionId: string, keys: Map<string, Waiting[]>): Promise<void> {
    try {
      const reads = new Map((await this.readIssues(connectionId, [...keys.keys()])).map((read) => [read.key, read]));
      for (const [key, waiting] of keys) {
        const read: IssueRead = reads.get(key) ?? { key, kind: 'unreadable', reason: 'unexpected' };
        waiting.forEach(({ resolve }) => resolve(read));
      }
    } catch (error) {
      for (const waiting of keys.values()) waiting.forEach(({ reject }) => reject(error));
    }
  }
}
