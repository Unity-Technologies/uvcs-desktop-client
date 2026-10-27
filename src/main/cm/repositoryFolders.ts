import type { ListedTreeItem } from './treeItems';

/**
 * The folders directly inside a folder of a repository's tree, from its `cm ls --tree` listing, read
 * (`readTreeItem`): `/`-rooted paths (`/Assets/Lib`), sorted by name. An xlink nested in the repository is left out:
 * an xlink can't show a folder of it.
 */
export function subfoldersIn(listing: readonly ListedTreeItem[]): string[] {
  return listing
    .filter((item) => item.itemType === 'directory' && !item.xlink)
    .map((item) => `/${item.path.replace(/^\/+/, '')}`)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
