import type { ContentSource } from '@shared/domain/content';

/**
 * A diff is typed into directly when its modified side is a workspace file shown against its own past (the loaded
 * revision, the reviewed copy, or nothing for an added file). Diffs of history, merges and conflicts show other
 * versions of the file and stay read-only, even when one side is the workspace file.
 */
export function canEditInPlace(original: ContentSource, modified: ContentSource): modified is { kind: 'workspaceFile'; path: string } {
  if (modified.kind !== 'workspaceFile') return false;
  if (original.kind === 'empty') return true;
  return (original.kind === 'workspaceBase' || original.kind === 'reviewSnapshot') && original.path === modified.path;
}
