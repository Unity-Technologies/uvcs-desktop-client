import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { directoryConflictIdentity } from '@shared/domain/directoryConflictIdentity';
import type { DecidedMerge, DirectoryConflictResolution, DirectoryDecision, FileConflict, MergePlan, MergeRequest } from '@shared/domain/merge';
import type { CmClient } from '../cm/CmClient';
import { readFields } from '../cm/formatRecords';
import { mergePlanOf, type PrintedMergePlan } from '../cm/mergeOutput';
import { createTempDirectory, removeTempDirectory } from '../files/tempFile';
import type { WorkspaceCopies } from '../files/WorkspaceCopies';
import { withConflictRepositories } from './conflictRepositories';
import { mergePlanArgs } from './mergeArgs';
import { assertDecisionValid } from './mergeRules';
import { copyMergeState, mergeStateArgs, mergeStateFilesIn, type MergeStateFiles } from './mergeStateFiles';
import { previewMerge, readMergePlan } from './previewMerge';

/**
 * What a merge goes on from once directory decisions were applied (`runMerge`): the state `cm` kept after them, and the
 * file conflicts as the merge listed them before any decision, which the decisions may have moved to a path the
 * destination's tree doesn't hold but never changed (`withConflictRepositories`' `known`).
 */
export interface AppliedDirectoryDecisions {
  state: MergeStateFiles;
  known: readonly FileConflict[];
}

/** A decision `cm` applied: the state it kept after it (and those before), and the plan it printed then. */
interface AppliedDecision {
  decision: DirectoryDecision;
  state: MergeStateFiles;
  plan: PrintedMergePlan;
}

/** One merge page's decisions, in their own temporary folder: a folder per decision applied, each a copy of the one before plus that decision. */
interface DecidedMergeState {
  /** The workspace and merge they belong to: decisions sent for another merge under the same id start over. */
  merge: string;
  folder: string;
  applied: AppliedDecision[];
  /**
   * The merge before any decision, read once: the first decision's number in `cm`'s list, and its conflicting files
   * completed (`withConflictRepositories`), which the decisions may move but never change.
   */
  initial?: MergePlan;
  /** Folders made so far, to name the next one. */
  folders: number;
  /**
   * Decisions are applied one batch after the other, each starting from the state the one before left, and a merge
   * running on them holds them until it ends (`runOn`).
   */
  queue: Promise<unknown>;
}

/**
 * Applies a merge page's directory decisions as the user makes them, as the official client does: `cm merge
 * --resolveconflict` calculates the merge again on each decision and keeps it in its state files (`MergeStateFiles`),
 * without touching the workspace, and the plan it prints then is the page's (a decision can move, remove or add file
 * conflicts and changes). The merge then runs on that state (`runMerge`).
 *
 * `cm` can't take a decision back, so each decision's state is kept apart: changing one goes on from the state before
 * it and applies again the decisions after it, each to its conflict found again by its identity
 * (`directoryConflictIdentity`); a decision whose conflict is no longer in the merge is dropped.
 */
export class DirectoryDecisions {
  private readonly merges = new Map<string, DecidedMergeState>();

  constructor(
    private readonly cm: CmClient,
    private readonly copies?: Pick<WorkspaceCopies, 'remember'>,
  ) {}

  /** Applies `decisions`, in order, to the merge the page `id` shows, and returns the merge recalculated on them. */
  decide(workspacePath: string, request: MergeRequest, id: string, decisions: DirectoryDecision[]): Promise<DecidedMerge> {
    decisions.forEach(assertDecisionValid);
    const merge = this.mergeOf(id, mergeKey(workspacePath, request));
    const applying = merge.queue.then(() => this.apply(merge, workspacePath, request, decisions));
    merge.queue = applying.catch(() => undefined);
    return applying;
  }

  /** The state `cm` kept after the page's decisions; none before any decision. */
  stateOf(id: string): MergeStateFiles | undefined {
    return this.merges.get(id)?.applied.at(-1)?.state;
  }

  /**
   * Runs `work` (the merge) on the page `id`'s decisions, once a decision being applied ends, and holds them until it
   * ends, even if the page closes meanwhile. None (`undefined`) before any decision. Refuses decisions made for
   * another merge: the merge would run on that one's state.
   */
  runOn<T>(id: string | undefined, workspacePath: string, request: MergeRequest, work: (decided: AppliedDirectoryDecisions | undefined) => Promise<T>): Promise<T> {
    const merge = id === undefined ? undefined : this.merges.get(id);
    if (!merge) return work(undefined);
    if (merge.merge !== mergeKey(workspacePath, request)) return Promise.reject(new Error('These directory decisions were made for another merge. Review the merge again.'));
    const running = merge.queue.then(() => {
      const state = merge.applied.at(-1)?.state;
      return work(state && merge.initial && { state, known: merge.initial.fileConflicts });
    });
    merge.queue = running.catch(() => undefined);
    return running;
  }

  /** Forgets the page's decisions and deletes their folder, once a decision being applied, or a merge on them, ends. */
  discard(id: string): Promise<void> {
    const merge = this.merges.get(id);
    if (!merge) return Promise.resolve();
    this.merges.delete(id);
    return merge.queue.then(() => (merge.folder ? removeTempDirectory(merge.folder) : undefined));
  }

  private mergeOf(id: string, merge: string): DecidedMergeState {
    const current = this.merges.get(id);
    if (current?.merge === merge) return current;
    if (current) void this.discard(id);
    const started: DecidedMergeState = { merge, folder: '', applied: [], folders: 0, queue: Promise.resolve() };
    this.merges.set(id, started);
    return started;
  }

  private async apply(merge: DecidedMergeState, workspacePath: string, request: MergeRequest, decisions: DirectoryDecision[]): Promise<DecidedMerge> {
    // Kept only once every decision applied: one `cm` refuses leaves those applied before, as the page still shows them.
    const applied = merge.applied.slice(0, sameDecisionsCount(merge.applied, decisions));
    for (const decision of decisions.slice(applied.length)) {
      const conflicts = applied.at(-1)?.plan.directoryConflicts ?? (await this.initialOf(merge, workspacePath, request)).directoryConflicts;
      const index = conflicts.findIndex((conflict) => directoryConflictIdentity(conflict) === directoryConflictIdentity(decision.conflict));
      if (index < 0) continue;
      applied.push(await this.resolve(merge, workspacePath, request, applied.at(-1)?.state, { conflict: conflicts[index]!, resolution: decision.resolution }, index));
    }
    merge.applied = applied;

    const last = applied.at(-1);
    if (!last) return { plan: await previewMerge(this.cm, workspacePath, request, { copies: this.copies }), decisions: [] };
    const initial = await this.initialOf(merge, workspacePath, request);
    return {
      plan: await withConflictRepositories(this.cm, workspacePath, request, last.plan, this.copies, initial.fileConflicts),
      decisions: applied.map((one) => one.decision),
    };
  }

  private async initialOf(merge: DecidedMergeState, workspacePath: string, request: MergeRequest): Promise<MergePlan> {
    merge.initial ??= await withConflictRepositories(this.cm, workspacePath, request, await readMergePlan(this.cm, workspacePath, request), this.copies);
    return merge.initial;
  }

  /** `cm` resolves the conflict numbered `index + 1` in its list, on a copy of the state the decision `before` left. */
  private async resolve(
    merge: DecidedMergeState,
    workspacePath: string,
    request: MergeRequest,
    before: MergeStateFiles | undefined,
    decision: DirectoryDecision,
    index: number,
  ): Promise<AppliedDecision> {
    merge.folder ||= await createTempDirectory();
    const folder = join(merge.folder, String(++merge.folders));
    await mkdir(folder);
    const state = mergeStateFilesIn(folder);
    if (before) await copyMergeState(before, state);

    const args = [...mergePlanArgs(request), ...mergeStateArgs(state), ...resolveConflictArgs(index, decision.resolution)];
    const plan = mergePlanOf(await this.cm.queryRecords(args, readFields, { cwd: workspacePath }));
    return { decision, state, plan };
  }
}

/** Which merge decisions are for: a workspace and a merge request. */
function mergeKey(workspacePath: string, request: MergeRequest): string {
  return JSON.stringify([workspacePath, request]);
}

/** How many of the decisions applied are still the first ones asked, the same conflicts decided the same way. */
function sameDecisionsCount(applied: readonly AppliedDecision[], decisions: readonly DirectoryDecision[]): number {
  const same = (one: DirectoryDecision, other: DirectoryDecision): boolean =>
    directoryConflictIdentity(one.conflict) === directoryConflictIdentity(other.conflict) && sameResolution(one.resolution, other.resolution);
  const differing = applied.findIndex((step, index) => index >= decisions.length || !same(step.decision, decisions[index]!));
  return differing < 0 ? applied.length : differing;
}

function sameResolution(one: DirectoryConflictResolution, other: DirectoryConflictResolution): boolean {
  if (one.choice === 'rename' && other.choice === 'rename') return one.newName === other.newName;
  return one.choice === other.choice;
}

/** `cm merge --resolveconflict` for the conflict numbered `index + 1` in the list `cm` printed last. */
export function resolveConflictArgs(index: number, resolution: DirectoryConflictResolution): string[] {
  const common = ['--resolveconflict', `--conflict=${index + 1}`];
  switch (resolution.choice) {
    case 'source':
      return [...common, '--resolutionoption=src'];
    case 'destination':
      return [...common, '--resolutionoption=dst'];
    case 'rename':
      return [...common, '--resolutionoption=rename', `--resolutioninfo=${resolution.newName}`];
  }
}
