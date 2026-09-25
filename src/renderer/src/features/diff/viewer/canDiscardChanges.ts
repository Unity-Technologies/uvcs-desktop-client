import type { ContentSource } from '@shared/domain/content';

/**
 * Changes can be discarded only from a workspace file compared with its own past: the loaded revision or the copy
 * taken when it was reviewed. Diffs of history, merges and conflicts compare other versions and stay read-only; an
 * added file has nothing to go back to (undo or delete it instead).
 */
export function canDiscardChanges(original: ContentSource, modified: ContentSource): modified is { kind: 'workspaceFile'; path: string } {
  return modified.kind === 'workspaceFile' && (original.kind === 'workspaceBase' || original.kind === 'reviewSnapshot') && original.path === modified.path;
}
