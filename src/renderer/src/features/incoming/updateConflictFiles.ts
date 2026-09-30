import type { UpdateConflict, UpdateResolutions } from '@shared/domain/incoming';
import { WORKSPACE_ROLES, type MergeLabels } from '../merge/mergeDescription';
import type { ConflictedFile, FileConflictState } from '../merge/resolve/useFileConflicts';

/** The labels of an update merge: the branch head comes in, the local changes are yours. */
export const UPDATE_LABELS: MergeLabels = { source: 'the branch head', destination: 'your workspace', roles: WORKSPACE_ROLES };

/** Where to read the loaded, incoming and local versions of each file that needs merging to update. */
export function updateConflictFiles(conflicts: UpdateConflict[]): ConflictedFile[] {
  return conflicts.map((conflict) => ({
    key: conflict.path,
    path: conflict.path,
    base: { kind: 'revision', revision: { revisionId: conflict.baseRevisionId, repository: conflict.repository }, fileName: conflict.path },
    source: { kind: 'revision', revision: { revisionId: conflict.incomingRevisionId, repository: conflict.repository }, fileName: conflict.path },
    destination: { kind: 'workspaceFile', path: conflict.path },
  }));
}

/** What the update writes for each file that needs merging, once every one is decided; null while some wait. */
export function updateResolutionsOf(states: FileConflictState[]): UpdateResolutions | null {
  const resolutions: UpdateResolutions = {};
  for (const state of states) {
    if (!state.resolution) return null;
    resolutions[state.file.key] = state.resolution;
  }
  return resolutions;
}
