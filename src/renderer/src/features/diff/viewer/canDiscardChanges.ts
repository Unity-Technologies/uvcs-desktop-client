import type { ContentSource } from '@shared/domain/content';
import { workspacePathOf, type Place } from '@shared/domain/place';
import type { WorkspaceFile } from './canEditInPlace';

/**
 * Changes can be discarded only from a workspace file compared with its own past: the loaded revision or the copy
 * taken when it was reviewed. Diffs of history, merges and conflicts compare other versions and stay read-only; an
 * added file has nothing to go back to (undo or delete it instead).
 */
export function canDiscardChanges(original: ContentSource, modified: ContentSource): modified is { kind: 'workspaceFile'; path: string } {
  return modified.kind === 'workspaceFile' && (original.kind === 'workspaceBase' || original.kind === 'reviewSnapshot') && original.path === modified.path;
}

/** The workspace file a diff discards changes from (`canDiscardChanges`), or none; none in a place with no workspace. */
export function discardedFileIn(place: Place, original: ContentSource, modified: ContentSource): WorkspaceFile | null {
  const workspacePath = workspacePathOf(place);
  return workspacePath !== null && canDiscardChanges(original, modified) ? { workspacePath, path: modified.path } : null;
}
