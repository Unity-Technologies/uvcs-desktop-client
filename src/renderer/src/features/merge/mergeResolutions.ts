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
    const resolution = intoServerBranch ? serverResolution(serverFilePolicy) : state.resolution;
    if (!resolution) return null;
    files[state.file.key] = resolution;
  }

  return { directoryConflicts: directoryConflicts as DirectoryConflictResolution[], files, comment };
}

/**
 * Whether a server merge must pick a side for all its conflicting files. It always must when there are any:
 * `cm` could only combine them with its external merge tool, which this app never opens.
 */
export function needsServerFilePolicy(fileStates: FileConflictState[]): boolean {
  return fileStates.length > 0;
}

function serverResolution(policy: ServerFilePolicy | undefined): FileConflictResolution | null {
  return policy ? { choice: policy } : null;
}
