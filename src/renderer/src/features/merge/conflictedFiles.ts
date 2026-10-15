import type { ContentSource } from '@shared/domain/content';
import { mergeSourcePoint, type FileConflict, type MergePlan, type MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { ConflictedFile } from './resolve/useFileConflicts';

/**
 * Where to read the ancestor, source and destination versions of each conflicting file of a merge. The destination's
 * by its revision, which the main process reads from the workspace's disk where its file has it (a workspace merge's
 * files mostly do), with no `cm cat`.
 */
export function conflictedFilesOf(plan: MergePlan, request: MergeRequest): ConflictedFile[] {
  return plan.fileConflicts.map((conflict) => ({
    key: conflict.path,
    path: conflict.path.replace(/^\//, ''),
    base: conflict.baseChangeset < 0 ? { kind: 'empty' } : versionAt(conflict, spec.changeset(conflict.baseChangeset)),
    source: versionAt(conflict, mergeSourcePoint(request, conflict.sourceChangeset)),
    destination: { kind: 'revision', revision: { revisionId: conflict.destinationRevisionId, repository: conflict.repository }, fileName: conflict.path },
  }));
}

function versionAt(conflict: FileConflict, pointSpec: string): ContentSource {
  return { kind: 'spec', spec: spec.itemAt(conflict.itemId, pointSpec, conflict.repository), fileName: conflict.path };
}
