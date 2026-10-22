import { lstat, type Stats } from 'node:fs';
import type { PendingChange } from '@shared/domain/pendingChanges';

/** `fs.lstat` as `DiskDetails` calls it: tests count the calls and answer them. */
export type ReadLinkStats = (path: string, done: (error: NodeJS.ErrnoException | null, stats?: Pick<Stats, 'size' | 'mtimeMs' | 'isSymbolicLink'>) => void) => void;

/** Reads at most this many items at once: enough to keep the disk busy, few enough to leave other reads a place in libuv's pool of four threads. */
export const MAX_READS_AT_ONCE = 16;

/**
 * Reads what `cm status` records don't hold of each change from the disk: its size and modification date (what
 * `cm status --xml` reported: the file as it is on disk), and whether it is a link. A local read, free for the
 * server. Started as each change arrives (`add`), while `cm` still prints the rest: reading 500,000 files takes about
 * two seconds, half of what the command does, so most of it ends with the command. Folders and items gone from the
 * disk keep no size and no date (`0`, `''`): nothing reads them.
 */
export class DiskDetails {
  private readonly changes: PendingChange[] = [];
  private readonly paths: string[] = [];
  private next = 0;
  private reading = 0;
  private closed = false;
  private settle: (() => void) | undefined;

  constructor(private readonly readLinkStats: ReadLinkStats = lstat) {}

  /** Reads `change`'s details from `absolutePath`, when it has any on disk. */
  add(change: PendingChange, absolutePath: string): void {
    if (change.itemType === 'directory' || isGoneFromDisk(change)) return;
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

  private readMore(): void {
    while (this.reading < MAX_READS_AT_ONCE && this.next < this.changes.length) {
      const index = this.next++;
      this.reading++;
      this.readLinkStats(this.paths[index]!, (error, stats) => {
        this.reading--;
        // A file removed meanwhile, or that can't be read, keeps no details; the next read sees how it is.
        if (!error && stats) withDetails(this.changes[index]!, stats);
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
