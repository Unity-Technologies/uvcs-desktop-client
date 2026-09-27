import type { ItemType } from '@shared/domain/pendingChanges';

/**
 * What each path of a merge is, for its icon: `cm merge` names no item types, but a folder added, deleted or moved
 * comes with the items inside it, so a path with others listed under it is a folder.
 */
export function mergeItemTypes(paths: readonly string[]): (path: string) => ItemType {
  const folders = new Set<string>();
  for (const path of paths) {
    for (let slash = path.indexOf('/', 1); slash !== -1; slash = path.indexOf('/', slash + 1)) folders.add(path.slice(0, slash));
  }
  return (path) => (folders.has(path) ? 'directory' : 'file');
}
