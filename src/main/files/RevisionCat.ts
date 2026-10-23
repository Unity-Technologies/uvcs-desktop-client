// Revisions saved to files with `cm cat` (ARCHITECTURE.md "Server budget"), the ones asked together in one command: a
// merge page reads three versions of every conflicting file but its known binaries at once, and a command each would be
// thousands of process starts and connections. A read asked while no `cm cat` runs starts at once, as the one quick
// command it always was; one asked while others run waits for one of them to end.

import { rm, stat } from 'node:fs/promises';
import type { CmClient } from '../cm/CmClient';
import { CmError } from '../cm/CmError';
import { catArgs, explainCatFailure, nextCatBatch, type CatRead } from '../cm/catBatches';

/**
 * The most `cm cat`s that run at once in a workspace. Reads asked meanwhile wait, and the next batch is formed from
 * what waits as one ends: how batches grow while many reads arrive.
 */
export const MAX_RUNNING_CATS = 2;
/**
 * The most revisions a quick `cm cat` reads in a pooled `cm shell` (`query()`): a diff's two sides, a conflict's three
 * versions. A bigger batch runs as a process of its own (`execute()`). One quick `cm cat` runs at a time: a workspace
 * has two pooled sessions, and every other read of it waits behind those.
 */
export const MAX_QUICK_CAT = 4;
/**
 * The most revisions waiting that are read in quick `cm cat`s, one after the other in one pooled session, the session
 * free between them for any other read: a small merge's few dozen versions, about a millisecond each on a warm session
 * where a process costs 100-150 ms to start. Past it (a big merge's thousands), batches go to processes.
 */
export const MAX_QUICK_BACKLOG = 64;

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

/**
 * A workspace's reads: those waiting, how many `cm cat`s run (and whether one holds a pooled session), the group read
 * last.
 */
interface WorkspaceReads {
  waiting: Waiting[];
  running: number;
  quickRunning: boolean;
  lastGroup: string | null;
  scheduled: boolean;
}

/** Reads a failed `cm cat` didn't tell about, and its failure. */
interface Unexplained {
  reads: Waiting[];
  failure: unknown;
}

interface RevisionCatOptions {
  cm: Pick<CmClient, 'query' | 'execute'>;
  /**
   * Runs the reads asked so far: once the IPC calls that arrived together have asked theirs. `setImmediate` runs
   * after the I/O callbacks at hand, with no timer's delay.
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
    if (!reads) this.workspaces.set(workspacePath, (reads = { waiting: [], running: 0, quickRunning: false, lastGroup: null, scheduled: false }));
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

  /**
   * Starts batches while fewer than `MAX_RUNNING_CATS` run, each formed from what waits then (`nextCatBatch`): after
   * one group's batch, another group's reads go first, so another view's read waits for one batch, not the queue. A
   * few revisions wait for the quick `cm cat` running to end rather than start a process: it answers in milliseconds,
   * where starting `cm` costs 100-150 ms (a diff's two sides, asked a moment apart). While what waits is at most
   * `MAX_QUICK_BACKLOG`, it is all read so, a quick `cm cat` after another (a small merge); past it, in batches as big
   * as a command line takes, each a process.
   */
  private runWaiting(workspacePath: string, reads: WorkspaceReads): void {
    while (reads.running < MAX_RUNNING_CATS && reads.waiting.length > 0) {
      const limits = reads.waiting.length > MAX_QUICK_BACKLOG ? {} : { maxReads: MAX_QUICK_CAT };
      const { batch, group } = nextCatBatch(reads.waiting, (read) => read, reads.lastGroup, limits);
      if (isQuick(batch) && reads.quickRunning) break;
      const taken = new Set(batch);
      reads.waiting = reads.waiting.filter((read) => !taken.has(read));
      reads.lastGroup = group;
      reads.running++;
      void this.runBatch(workspacePath, reads, batch).finally(() => {
        reads.running--;
        if (reads.running === 0 && reads.waiting.length === 0) this.workspaces.delete(workspacePath);
        else this.runWaiting(workspacePath, reads);
      });
    }
  }

  /**
   * One `cm cat` of the batch, then the reads its failure didn't tell about narrowed down in halves (`narrowDown`).
   */
  private async runBatch(workspacePath: string, reads: WorkspaceReads, batch: Waiting[]): Promise<void> {
    const unexplained = await this.attempt(workspacePath, reads, batch);
    if (unexplained) await this.narrowDown(workspacePath, reads, unexplained);
  }

  /**
   * A `cm cat` that failed for reasons it didn't tell per revision (a spec it couldn't take fails the whole command
   * before it writes anything): its halves are read again, and the half that fails again split the same way, so one
   * bad spec is found in about two commands per halving, never one per read. When both halves fail, it failed for
   * them all (a dropped connection): they fail.
   */
  private async narrowDown(workspacePath: string, reads: WorkspaceReads, { reads: unexplained }: Unexplained): Promise<void> {
    // Read again alone, it settles with its own answer: a good revision isn't failed with another's error.
    if (unexplained.length === 1) return void (await this.attempt(workspacePath, reads, unexplained));
    const middle = Math.ceil(unexplained.length / 2);
    const first = await this.attempt(workspacePath, reads, unexplained.slice(0, middle));
    const second = await this.attempt(workspacePath, reads, unexplained.slice(middle));
    if (first && second) return [first, second].forEach(({ reads: failed, failure: why }) => failed.forEach((read) => read.reject(why)));
    const failedAgain = first ?? second;
    if (failedAgain) await this.narrowDown(workspacePath, reads, failedAgain);
  }

  /**
   * Runs `cm cat` of the reads and settles those it can tell about. `cm cat` writes every revision it found even when
   * another failed, and names each it didn't find (`The specified revision was not found <spec>`): a read not written
   * fails with its own line. When every line of the failure names such a read, the others were written whole;
   * otherwise (one cut short by a dropped connection, a failure naming nothing) they are returned, unexplained.
   */
  private async attempt(workspacePath: string, reads: WorkspaceReads, batch: Waiting[]): Promise<Unexplained | null> {
    const failure = await this.run(workspacePath, reads, batch).then(
      () => null,
      (error: unknown) => error,
    );
    if (failure === null) return batch.forEach((read) => read.resolve()), null;
    if (batch.length === 1) return batch[0]!.reject(failure), null;
    const written = await Promise.all(batch.map((read) => stat(read.target).then(() => true, () => false)));
    const { unwritten, everyLineExplained } = explainCatFailure(
      batch.filter((_, i) => !written[i]),
      failure,
    );
    unwritten.forEach(({ read, line }) => read.reject((failure as CmError).withMessage(line)));
    const missing = unwritten.map(({ read }) => read);
    const rest = batch.filter((read) => !missing.includes(read));
    if (everyLineExplained) rest.filter((read) => written[batch.indexOf(read)]).forEach((read) => read.resolve());
    const unexplained = everyLineExplained ? rest.filter((read) => !written[batch.indexOf(read)]) : rest;
    if (unexplained.length === 0) return null;
    await Promise.all(unexplained.map((read) => rm(read.target, { force: true }).catch(() => undefined)));
    return { reads: unexplained, failure };
  }

  /**
   * A few revisions in a pooled session, unless another quick `cm cat` holds one (halves read again while one runs);
   * more in a process of their own.
   */
  private async run(workspacePath: string, reads: WorkspaceReads, batch: Waiting[]): Promise<void> {
    if (!isQuick(batch) || reads.quickRunning) return void (await this.cm.execute(catArgs(batch), { cwd: workspacePath }));
    reads.quickRunning = true;
    try {
      await this.cm.query(catArgs(batch), { cwd: workspacePath });
    } finally {
      reads.quickRunning = false;
    }
  }
}

function isQuick(batch: readonly Waiting[]): boolean {
  return batch.length <= MAX_QUICK_CAT;
}
