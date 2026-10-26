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
import { readMergePlan } from './previewMerge';

/** How many previewed merges are remembered: one per page open, a few windows at most. */
const REMEMBERED_PREVIEWS = 4;

/**
 * What a merge goes on from once directory decisions were applied (`runMerge`): the state `cm` kept after them, and the
 * file conflicts as the merge listed them before any decision, which the decisions may have moved to a path the
 * destination's tree doesn't hold but never changed (`withConflictRepositories`' `known`).
 */
export interface AppliedDirectoryDecisions {
  state: MergeStateFiles;
  known: readonly FileConflict[];
}

/** A decision `cm` applied: the state it kept after it (and those before) in its own folder, and the plan it printed then. */
interface AppliedDecision {
  decision: DirectoryDecision;
  folder: string;
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
  /**
   * The last merges previewed, by `mergeKey`, not by page: a page's first decision starts from the merge it shows (two
   * pages of the same merge, from the newer preview). Should it be out of date, `cm` finds the merge changed
   * (`resolve`).
   */
  private readonly previews = new Map<string, MergePlan>();

  constructor(
    private readonly cm: CmClient,
    private readonly copies?: Pick<WorkspaceCopies, 'remember'>,
  ) {}

  /**
   * Remembers the merge a page previewed (`merge.preview`), so that its first decision starts from it instead of
   * calculating the merge again. Only the last few: a page opened from an older one previews it again anyway.
   */
  previewed(workspacePath: string, request: MergeRequest, plan: MergePlan): void {
    if (plan.status !== 'ready') return;
    const key = mergeKey(workspacePath, request);
    this.previews.delete(key);
    this.previews.set(key, plan);
    if (this.previews.size > REMEMBERED_PREVIEWS) this.previews.delete(this.previews.keys().next().value!);
  }

  /** Applies `decisions`, in order, to the merge the page `id` shows, and returns the merge recalculated on them. */
  async decide(workspacePath: string, request: MergeRequest, id: string, decisions: DirectoryDecision[]): Promise<DecidedMerge> {
    decisions.forEach(assertDecisionValid);
    const merge = this.mergeOf(id, mergeKey(workspacePath, request));
    const applying = merge.queue.then(() => this.apply(merge, workspacePath, request, decisions));
    merge.queue = applying.catch(() => undefined);
    return applying;
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
    // The states of the decisions applied again go: a merge never runs on them.
    await Promise.all(merge.applied.filter((step) => !applied.includes(step)).map((cut) => removeTempDirectory(cut.folder)));
    merge.applied = applied;

    const initial = await this.initialOf(merge, workspacePath, request);
    const last = applied.at(-1);
    if (!last) return { plan: initial, decisions: [] };
    return {
      plan: await withConflictRepositories(this.cm, workspacePath, request, last.plan, this.copies, initial.fileConflicts),
      decisions: applied.map((one) => one.decision),
    };
  }

  /** The merge before any decision: the one the page previewed, else read again (and its conflicting files listed). */
  private async initialOf(merge: DecidedMergeState, workspacePath: string, request: MergeRequest): Promise<MergePlan> {
    merge.initial ??=
      this.previews.get(merge.merge) ??
      (await withConflictRepositories(this.cm, workspacePath, request, await readMergePlan(this.cm, workspacePath, request), this.copies));
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
    // `cm` drops the conflict it resolved from the list it prints. One still listed means it resolved another: the
    // merge changed since the list the number came from (a preview out of date, someone checked in meanwhile).
    const decided = directoryConflictIdentity(decision.conflict);
    if (plan.directoryConflicts.some((conflict) => directoryConflictIdentity(conflict) === decided)) {
      throw new Error('The merge changed since it was calculated. Review it again.');
    }
    return { decision, folder, state, plan };
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
