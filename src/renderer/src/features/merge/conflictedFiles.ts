import type { ContentSource } from '@shared/domain/content';
import { baseVersionSpec, destinationVersionSpec, hasMergeBase, sourceVersionSpec, type FileConflict, type MergePlan, type MergeRequest } from '@shared/domain/merge';
import type { ConflictedFile } from './resolve/useFileConflicts';

/**
 * Where to read the ancestor, source and destination versions of each conflicting file of a merge. The destination's
 * by its revision, which the main process reads from the workspace's disk where its file has it (a workspace merge's
 * files mostly do), with no `cm cat`.
 */
export function conflictedFilesOf(plan: MergePlan, request: MergeRequest): ConflictedFile[] {
  return plan.fileConflicts.map((conflict) => ({
    key: fileConflictKey(conflict),
    path: conflict.path.replace(/^\//, ''),
    base: hasMergeBase(conflict) ? versionAt(conflict, baseVersionSpec(conflict)) : { kind: 'empty' },
    ...(hasMergeBase(conflict) && { baseName: `cs:${conflict.baseChangeset}` }),
    source: versionAt(conflict, sourceVersionSpec(request, conflict)),
    destination: destinationOf(conflict),
    ...(conflict.destinationIsBinary && { isKnownBinary: true }),
    ...(request.kind === 'subtractive' && hasMergeBase(conflict) && { baseIsUndoneChange: true }),
  }));
}

/**
 * What the merge page keys a conflicting file by: its item, in its repository, never its path. A directory decision
 * can move the file (a folder moved apart on both sides: `DirectoryDecisions`), and its decision moves with it.
 */
export function fileConflictKey({ itemId, repository }: Pick<FileConflict, 'itemId' | 'repository'>): string {
  return `${itemId}@${repository}`;
}

/** By its revision, which the workspace's disk may hold; else, the plan naming none, as the item at its changeset. */
function destinationOf(conflict: FileConflict): ContentSource {
  if (conflict.destinationRevisionId === undefined) return versionAt(conflict, destinationVersionSpec(conflict));
  return { kind: 'revision', revision: { revisionId: conflict.destinationRevisionId, repository: conflict.repository }, fileName: conflict.destinationPath };
}

function versionAt(conflict: FileConflict, versionSpec: string): ContentSource {
  return { kind: 'spec', spec: versionSpec, fileName: conflict.destinationPath };
}
