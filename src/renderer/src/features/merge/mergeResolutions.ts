import type { FileConflictResolution, MergePlan, MergeResolutions } from '@shared/domain/merge';
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

  const files: Record<string, FileConflictResolution> = {};
  for (const state of fileStates) {
    if (!state.resolution) return null;
    files[state.file.key] = state.resolution;
  }

  return { ...(directoryDecisionsId !== undefined && { directoryDecisionsId }), files, comment };
}
