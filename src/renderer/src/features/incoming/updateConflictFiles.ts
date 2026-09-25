import type { UpdateConflict } from '@shared/domain/incoming';
import { WORKSPACE_ROLES, type MergeLabels } from '../merge/mergeDescription';
import type { ConflictedFile } from '../merge/resolve/useFileConflicts';

/** The labels of an update merge: the branch head comes in, the local changes are yours. */
export const UPDATE_LABELS: MergeLabels = { source: 'the branch head', destination: 'your workspace', roles: WORKSPACE_ROLES };

/** Where to read the loaded, incoming and local versions of each file that needs merging to update. */
export function updateConflictFiles(conflicts: UpdateConflict[]): ConflictedFile[] {
  return conflicts.map((conflict) => ({
    key: conflict.path,
    path: conflict.path,
    base: { kind: 'revision', revisionId: conflict.baseRevisionId, fileName: conflict.path },
    source: { kind: 'revision', revisionId: conflict.incomingRevisionId, fileName: conflict.path },
    destination: { kind: 'workspaceFile', path: conflict.path },
  }));
}
