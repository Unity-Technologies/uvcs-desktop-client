import type { TreeItem } from '@shared/domain/explorer';
import type { WorkspaceKind } from '@shared/domain/workspace';

/**
 * Whether Files shows that nothing is downloaded yet, with the way to choose what to: a partial workspace whose root is
 * listed and empty, as one is right after it's created. Elsewhere an empty root is an empty repository, with nothing to
 * choose, so the tree shows as usual.
 */
export function showsNothingDownloaded(kind: WorkspaceKind | undefined, childrenByDirectory: ReadonlyMap<string, readonly TreeItem[]>): boolean {
  return kind === 'partial' && childrenByDirectory.get('')?.length === 0;
}
