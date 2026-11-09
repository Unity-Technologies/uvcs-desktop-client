import type { FileConflictResolution, MergePlan, MergeResolutions } from '@shared/domain/merge';
import { fileConflictKey } from './conflictedFiles';
import type { FileConflictState } from './resolve/useFileConflicts';

interface CollectResolutionsInput {
  plan: MergePlan;
  fileStates: FileConflictState[];
  /** The page's directory decisions, applied as they're made (`decideDirectoryConflicts`): the merge goes on from them. */
  directoryDecisionsId?: string;
  comment?: string;
}

/**
 * Everything the merge needs, or null while any conflict still waits for the user: a directory conflict the plan still
 * lists has no decision, as each one decided is applied and leaves it.
 */
export function collectResolutions({ plan, fileStates, directoryDecisionsId, comment }: CollectResolutionsInput): MergeResolutions | null {
  if (plan.directoryConflicts.length > 0) return null;

  // Sent by the path the plan names the file at now; the page keys it by its item (`fileConflictKey`).
  const states = new Map(fileStates.map((state) => [state.file.key, state]));
  const files: Record<string, FileConflictResolution> = {};
  for (const conflict of plan.fileConflicts) {
    const resolution = states.get(fileConflictKey(conflict))?.resolution;
    if (!resolution) return null;
    files[conflict.path] = resolution;
  }

  // Trimmed, as a check-in's comment is (`joinComment`): a picked suggestion leaves a space after it.
  return { ...(directoryDecisionsId !== undefined && { directoryDecisionsId }), files, comment: comment?.trim() };
}
