import { lstat, type Stats } from 'node:fs';
import type { PendingChange } from '@shared/domain/pendingChanges';

/** `fs.lstat` as `DiskDetails` calls it: tests count the calls and answer them. */
export type ReadLinkStats = (path: string, done: (error: NodeJS.ErrnoException | null, stats?: Pick<Stats, 'size' | 'mtimeMs' | 'isSymbolicLink'>) => void) => void;

/**
 * Reads at most this many items at once: enough to keep libuv's four threads busy (a million took 5.3 s with 16, 7.6 s
 * with 4), few enough that another read of the main process waits behind 16 of them at most, well under a millisecond.
 */
export const MAX_READS_AT_ONCE = 16;

/**
 * Reads what `cm status` records don't hold of each change from the disk: its size and modification date (what
 * `cm status --xml` reported: the file as it is on disk), and whether it is a link. A local read, free for the
 * server. Started as each change arrives (`add`), a few at a time; `cm status` prints its changes once it found them
 * all, so the reads follow the command: a million files took 4 s more than the command's 5 s (500,000: 2 s), as many
 * reads in worker threads would still take 2.5 s (macOS). Folders and items gone from the disk keep no size and no
 * date (`0`, `''`): nothing reads them.
 */
export class DiskDetails {
  // A slot is let go once its read is done: a million changes keep alive only those still to read.
  private readonly changes: (PendingChange | undefined)[] = [];
  private readonly paths: (string | undefined)[] = [];
  private next = 0;
  private reading = 0;
  private closed = false;
  private stopped = false;
  private settle: (() => void) | undefined;

  constructor(private readonly readLinkStats: ReadLinkStats = lstat) {}

  /** Reads `change`'s details from `absolutePath`, when it has any on disk. */
  add(change: PendingChange, absolutePath: string): void {
    if (this.stopped || change.itemType === 'directory' || isGoneFromDisk(change)) return;
    this.changes.push(change);
    this.paths.push(absolutePath);
    this.readMore();
  }

  /** Once every change was added: resolves when every read is done. */
  finished(): Promise<void> {
    this.closed = true;
    if (this.isDone()) return Promise.resolve();
    return new Promise((resolve) => (this.settle = resolve));
  }

  /** Starts no more reads (the command failed): those already started end, and what waits is let go. */
  stop(): void {
    this.stopped = true;
    this.changes.length = this.next;
    this.paths.length = this.next;
  }

  private readMore(): void {
    while (!this.stopped && this.reading < MAX_READS_AT_ONCE && this.next < this.changes.length) {
      const index = this.next++;
      this.reading++;
      const [change, path] = [this.changes[index]!, this.paths[index]!];
      this.changes[index] = undefined;
      this.paths[index] = undefined;
      this.readLinkStats(path, (error, stats) => {
        this.reading--;
        // A file removed meanwhile, or that can't be read, keeps no details; the next read sees how it is.
        if (!error && stats) withDetails(change, stats);
        this.readMore();
        if (this.isDone()) this.settle?.();
      });
    }
  }

  private isDone(): boolean {
    return this.closed && this.reading === 0 && this.next === this.changes.length;
  }
}

function withDetails(change: PendingChange, stats: Pick<Stats, 'size' | 'mtimeMs' | 'isSymbolicLink'>): void {
  change.size = stats.size;
  change.lastModified = new Date(stats.mtimeMs).toISOString();
  if (stats.isSymbolicLink()) change.itemType = 'symlink';
}

function isGoneFromDisk(change: PendingChange): boolean {
  return change.kinds.includes('deleted') || change.kinds.includes('locallyDeleted');
}
