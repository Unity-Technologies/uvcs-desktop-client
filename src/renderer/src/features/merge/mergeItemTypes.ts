import type { ItemType } from '@shared/domain/pendingChanges';
import { enclosingFolders } from '../../lib/enclosingFolders';

/**
 * What each path of a merge is, for its icon: `cm merge` names no item types, but a folder added, deleted or moved
 * comes with the items inside it, so a path with others listed under it is a folder.
 */
export function mergeItemTypes(paths: readonly string[]): (path: string) => ItemType {
  const folders = enclosingFolders(paths);
  return (path) => (folders.has(path) ? 'directory' : 'file');
}
