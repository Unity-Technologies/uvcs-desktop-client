import type { DirectoryConflictResolution, FileConflictResolution, MergePlan, MergeResolutions } from '@shared/domain/merge';
import type { FileConflictState } from './resolve/useFileConflicts';

/** A merge into a server branch keeps one side for every conflicting file (there is no workspace to write the others in). */
export type ServerFilePolicy = 'source' | 'destination';

interface CollectResolutionsInput {
  plan: MergePlan;
  fileStates: FileConflictState[];
  directoryResolutions: readonly (DirectoryConflictResolution | undefined)[];
  /** Set for merges into a server branch. */
  serverFilePolicy?: ServerFilePolicy;
  intoServerBranch: boolean;
  comment?: string;
}

/** Everything the merge needs, or null while any conflict still waits for the user. */
export function collectResolutions({
  plan,
  fileStates,
  directoryResolutions,
  serverFilePolicy,
  intoServerBranch,
  comment,
}: CollectResolutionsInput): MergeResolutions | null {
  const directoryConflicts = plan.directoryConflicts.map((_, index) => directoryResolutions[index]);
  if (directoryConflicts.some((resolution) => !resolution)) return null;

  const files: Record<string, FileConflictResolution> = {};
  for (const state of fileStates) {
    const resolution = intoServerBranch ? serverResolution(state, serverFilePolicy) : state.resolution;
    if (!resolution) return null;
    files[state.file.key] = resolution;
  }

  return { directoryConflicts: directoryConflicts as DirectoryConflictResolution[], files, comment };
}

/** Whether some conflicting file can't be merged automatically, so a server merge must pick a side for all. */
export function needsServerFilePolicy(fileStates: FileConflictState[]): boolean {
  return fileStates.some((state) => state.status === 'ready' && !state.mergedAutomatically);
}

function serverResolution(state: FileConflictState, policy: ServerFilePolicy | undefined): FileConflictResolution | null {
  if (policy) return { choice: policy };
  return state.mergedAutomatically ? state.resolution : null;
}
