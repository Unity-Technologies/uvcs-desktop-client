// Revisions saved to files with `cm cat` (ARCHITECTURE.md "Server budget"), the ones asked together in one command:
// a merge page reads three versions of every conflicting file at once, a command each would be thousands. A read asked
// alone runs at once, as the one quick command it always was.

import { rm, stat } from 'node:fs/promises';
import type { CmClient } from '../cm/CmClient';
import { CmError } from '../cm/CmError';
import { catArgs, catBatchesOf, type CatRead } from '../cm/catBatches';

/**
 * The most `cm cat`s that run at once in a workspace. Reads asked meanwhile wait, and go together in the next ones:
 * how batches grow while many reads arrive, while one asked alone runs at once.
 */
export const MAX_RUNNING_CATS = 2;
/**
 * The most revisions a quick `cm cat` reads: a few files, about as quick as one (a diff's two sides, a conflict's three
 * versions), go in a pooled `cm shell` (`query()`). A bigger batch runs as a process of its own (`execute()`): it may
 * take seconds, and would hold a session every other read of the workspace waits behind.
 */
export const MAX_QUICK_CAT = 4;

/** A revision as `cm cat` reads it. */
export interface CatRevision {
  spec: string;
  /** The repository the spec reads in (`repositoryOfSpec`); null where it can't be told, and it is read alone. */
  repository: string | null;
}

interface Waiting extends CatRead {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** A workspace's reads: those waiting to be batched, the batches formed and waiting for a `cm cat`, and how many run. */
interface WorkspaceReads {
  waiting: Waiting[];
  batches: Waiting[][];
  running: number;
  scheduled: boolean;
}

interface RevisionCatOptions {
  cm: Pick<CmClient, 'query' | 'execute'>;
  /**
   * Runs the reads asked so far: once the IPC calls that arrived together have asked theirs. `setImmediate` runs
   * after the I/O callbacks at hand, with no timer's delay: a read asked alone isn't held back.
   */
  schedule?: (run: () => void) => void;
}

export class RevisionCat {
  private readonly cm: Pick<CmClient, 'query' | 'execute'>;
  private readonly schedule: (run: () => void) => void;
  private readonly workspaces = new Map<string, WorkspaceReads>();

  constructor({ cm, schedule = (run) => void setImmediate(run) }: RevisionCatOptions) {
    this.cm = cm;
    this.schedule = schedule;
  }

  /** Saves the revision to `target`, with the reads asked with it; rejects as `cm` failed for it. */
  save(workspacePath: string, { spec, repository }: CatRevision, target: string): Promise<void> {
    const reads = this.readsOf(workspacePath);
    return new Promise<void>((resolve, reject) => {
      reads.waiting.push({ spec, repository, target, size: -1, resolve, reject });
      this.runSoon(workspacePath, reads);
    });
  }

  private readsOf(workspacePath: string): WorkspaceReads {
    let reads = this.workspaces.get(workspacePath);
    if (!reads) this.workspaces.set(workspacePath, (reads = { waiting: [], batches: [], running: 0, scheduled: false }));
    return reads;
  }

  private runSoon(workspacePath: string, reads: WorkspaceReads): void {
    if (reads.scheduled) return;
    reads.scheduled = true;
    this.schedule(() => {
      reads.scheduled = false;
      this.runWaiting(workspacePath, reads);
    });
  }

  /** Starts the next batches while fewer than `MAX_RUNNING_CATS` run, batching what waits once those formed are taken. */
  private runWaiting(workspacePath: string, reads: WorkspaceReads): void {
    while (reads.running < MAX_RUNNING_CATS) {
      if (reads.batches.length === 0 && reads.waiting.length > 0) {
        reads.batches = catBatchesOf(reads.waiting, (read) => read);
        reads.waiting = [];
      }
      const batch = reads.batches.shift();
      if (!batch) break;
      reads.running++;
      void this.runBatch(workspacePath, batch).finally(() => {
        reads.running--;
        if (reads.running === 0 && reads.waiting.length === 0 && reads.batches.length === 0) this.workspaces.delete(workspacePath);
        else this.runWaiting(workspacePath, reads);
      });
    }
  }

  /**
   * One `cm cat` of the batch. `cm cat` writes every revision it found even when another failed, and names each it
   * didn't find (`The specified revision was not found <spec>`): a revision not written fails with its own line where
   * `cm` printed one. One written by a command that failed may be cut short (a dropped connection): those are read
   * again once, together (never a command each); failing again, they fail.
   */
  private async runBatch(workspacePath: string, batch: Waiting[], retried = false): Promise<void> {
    const run = batch.length <= MAX_QUICK_CAT ? this.cm.query : this.cm.execute;
    const failure = await run.call(this.cm, catArgs(batch), { cwd: workspacePath }).then(
      () => null,
      (error: unknown) => error,
    );
    if (failure === null) return batch.forEach((read) => read.resolve());
    if (batch.length === 1) return batch[0]!.reject(failure);
    const again: Waiting[] = [];
    await Promise.all(
      batch.map(async (read) => {
        const written = await stat(read.target).then(() => true, () => false);
        if (!written) return read.reject(failureOf(read, failure));
        if (retried) return read.reject(failure);
        await rm(read.target, { force: true }).catch(() => undefined);
        again.push(read);
      }),
    );
    if (again.length > 0) await this.runBatch(workspacePath, again, true);
  }
}

/** The failure of one revision of a batch: the line `cm` printed naming its spec, else the command's. */
function failureOf(read: CatRead, failure: unknown): unknown {
  if (!(failure instanceof CmError)) return failure;
  const line = failure.command.output.split(/\r?\n/).find((candidate) => candidate.trim().endsWith(` ${read.spec}`));
  return line === undefined ? failure : failure.withMessage(line.trim());
}
