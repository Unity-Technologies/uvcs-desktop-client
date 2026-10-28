import type { DecidedMerge, DirectoryConflict, DirectoryConflictResolution, DirectoryDecision, MergeRequest } from '@shared/domain/merge';
import { api } from '../../../api/client';
import { fileNameOf } from '../../../lib/text';
import { toast } from '../../../ui/toast/toastStore';
import { droppedDecisions, droppedDecisionsToast, withDecision } from './directoryDecisions';

/**
 * Applies the user's decision on a directory conflict to the merge, after the page's earlier ones
 * (`decideDirectoryConflicts`), and resolves with the merge calculated again on them. Decisions an earlier one took
 * out of the merge are told in a toast. Null when it failed: a toast says why, and the page stays as it was.
 */
export async function applyDirectoryDecision(
  workspacePath: string,
  request: MergeRequest,
  decisionsId: string,
  decided: readonly DirectoryDecision[],
  conflict: DirectoryConflict,
  resolution: DirectoryConflictResolution,
): Promise<DecidedMerge | null> {
  const asked = withDecision(decided, conflict, resolution);
  try {
    const merge = await api.merge.decideDirectoryConflicts(workspacePath, request, decisionsId, asked);
    const dropped = droppedDecisions(asked, merge.decisions);
    if (dropped.length > 0) {
      const { title, detail } = droppedDecisionsToast(dropped);
      toast.info(title, detail);
    }
    return merge;
  } catch (error) {
    toast.error(`Couldn't apply your decision on ${fileNameOf(conflict.destination.path)}`, error);
    return null;
  }
}
