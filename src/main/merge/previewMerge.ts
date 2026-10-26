import type { FileConflict, MergePlan, MergeRequest } from '@shared/domain/merge';
import type { CmClient } from '../cm/CmClient';
import { CmError, SILENT_FAILURE_MESSAGE } from '../cm/CmError';
import { readFields } from '../cm/formatRecords';
import { mergePlanOf, type PrintedMergePlan } from '../cm/mergeOutput';
import type { WorkspaceCopies } from '../files/WorkspaceCopies';
import { withConflictRepositories } from './conflictRepositories';
import { hasPendingChanges } from './hasPendingChanges';
import { mergePlanArgs, mergeSourceArgs } from './mergeArgs';
import { mergeStateArgs, type MergeStateFiles } from './mergeStateFiles';

const PENDING_CHANGES_PLAN: MergePlan = { status: 'pendingChanges', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };

interface PreviewOptions {
  /** Remembers the destination's revisions of the conflicting files, for the merge page to read them from the workspace's disk where it has them. */
  copies?: Pick<WorkspaceCopies, 'remember'>;
  /** The merge after the directory decisions `cm` keeps in these files (`DirectoryDecisions`), instead of before any. */
  state?: MergeStateFiles;
  /** The file conflicts as listed before those decisions, which they may have moved (`withConflictRepositories`). */
  known?: readonly FileConflict[];
}

/** Asks `cm` what a merge would do. Nothing in the workspace changes. */
export async function previewMerge(cm: CmClient, workspacePath: string, request: MergeRequest, { copies, state, known }: PreviewOptions = {}): Promise<MergePlan> {
  const intoWorkspace = !request.destinationBranch;
  if (intoWorkspace && (await hasPendingChanges(cm, workspacePath))) return PENDING_CHANGES_PLAN;
  return withConflictRepositories(cm, workspacePath, request, await readMergePlan(cm, workspacePath, request, state), copies, known);
}

/** The plan as `cm merge` prints it, after the directory decisions in `state` when given. */
export async function readMergePlan(cm: CmClient, workspacePath: string, request: MergeRequest, state?: MergeStateFiles): Promise<PrintedMergePlan> {
  try {
    const args = [...mergePlanArgs(request), ...(state ? mergeStateArgs(state) : [])];
    return mergePlanOf(await cm.queryRecords(args, readFields, { cwd: workspacePath }));
  } catch (error) {
    throw await explainFailure(cm, workspacePath, request, error);
  }
}

/** The machine-readable preview can fail silently; the plain one explains why. */
async function explainFailure(cm: CmClient, workspacePath: string, request: MergeRequest, error: unknown): Promise<unknown> {
  if (!(error instanceof CmError) || error.message !== SILENT_FAILURE_MESSAGE) return error;
  try {
    await cm.query(['merge', ...mergeSourceArgs(request)], { cwd: workspacePath });
    return error;
  } catch (explained) {
    return explained;
  }
}
