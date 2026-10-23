import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import type { CmClient } from '../cm/CmClient';
import { CmError, SILENT_FAILURE_MESSAGE } from '../cm/CmError';
import { readFields } from '../cm/formatRecords';
import { MERGE_PREVIEW_RECORD_ARGS, mergePlanOf } from '../cm/mergeOutput';
import type { WorkspaceCopies } from '../files/WorkspaceCopies';
import { withConflictRepositories } from './conflictRepositories';
import { hasPendingChanges } from './hasPendingChanges';
import { MACHINE_READABLE_ARGS, mergeSourceArgs } from './mergeArgs';

const PENDING_CHANGES_PLAN: MergePlan = { status: 'pendingChanges', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };

/**
 * Asks `cm` what a merge would do. Nothing in the workspace changes. `copies` remembers the destination's revisions of
 * the conflicting files, for the merge page to read them from the workspace's disk where it has them.
 */
export async function previewMerge(cm: CmClient, workspacePath: string, request: MergeRequest, copies?: Pick<WorkspaceCopies, 'remember'>): Promise<MergePlan> {
  const intoWorkspace = !request.destinationBranch;
  if (intoWorkspace && (await hasPendingChanges(cm, workspacePath))) return PENDING_CHANGES_PLAN;

  let records: string[][];
  try {
    const args = ['merge', ...mergeSourceArgs(request), ...MACHINE_READABLE_ARGS, ...MERGE_PREVIEW_RECORD_ARGS, '--printcontributors'];
    records = await cm.queryRecords(args, readFields, { cwd: workspacePath });
  } catch (error) {
    throw await explainFailure(cm, workspacePath, request, error);
  }
  return withConflictRepositories(cm, workspacePath, request, mergePlanOf(records), copies);
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
