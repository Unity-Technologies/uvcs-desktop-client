import type { DirectoryConflictResolution, FileConflictResolution, MergePlan, MergeResolutions } from '@shared/domain/merge';
import type { FileConflictState } from './resolve/useFileConflicts';

interface CollectResolutionsInput {
  plan: MergePlan;
  fileStates: FileConflictState[];
  directoryResolutions: readonly (DirectoryConflictResolution | undefined)[];
  comment?: string;
}

/** Everything the merge needs, or null while any conflict still waits for the user. */
export function collectResolutions({ plan, fileStates, directoryResolutions, comment }: CollectResolutionsInput): MergeResolutions | null {
  const directoryConflicts = plan.directoryConflicts.map((_, index) => directoryResolutions[index]);
  if (directoryConflicts.some((resolution) => !resolution)) return null;

  const files: Record<string, FileConflictResolution> = {};
  for (const state of fileStates) {
    if (!state.resolution) return null;
    files[state.file.key] = state.resolution;
  }

  return { directoryConflicts: directoryConflicts as DirectoryConflictResolution[], files, comment };
}
