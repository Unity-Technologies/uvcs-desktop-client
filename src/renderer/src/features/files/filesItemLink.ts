import type { TreeItem } from '@shared/domain/explorer';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import type { LinkLines, LinkObject } from '@shared/links/link';
import type { LinkTarget } from '../../app/links/linkNavigation';

/**
 * What a link to an item of the Files view names (docs/features/deep-links.md, "Where links are copied"): the item as
 * the repository has it on what the workspace is on, so it stays useful as a branch moves on
 * (`…/branches/main/-/browse/Assets/Player.cs`); its lines pinned to the changeset the workspace has loaded, as line
 * numbers shift along a branch (`…/changesets/28/-/browse/Player.cs#L40`). The repository's version, never the
 * workspace's own edits. None for an item the repository doesn't hold (private, ignored), one under an xlink (another
 * repository's), a workspace on a shelve, or lines of an older version, or of an item with pending changes (`changed`),
 * whose viewer shows the workspace's own lines, not the repository's.
 */
export function filesItemLink(
  workspace: Pick<WorkspaceInfo, 'repository' | 'selector' | 'loadedChangeset'>,
  item: Pick<TreeItem, 'path' | 'repository'>,
  lines?: LinkLines,
  { changed = false } = {},
): LinkTarget | null {
  if (item.repository !== workspace.repository) return null;
  const page = { kind: 'browse', path: `/${item.path}` } as const;
  if (lines) {
    if (changed || lines.side === 'old' || workspace.loadedChangeset === null) return null;
    return { object: { kind: 'changeset', id: workspace.loadedChangeset }, page, lines };
  }
  const object = workspaceObject(workspace);
  return object && { object, page };
}

/**
 * What ⇧⌘C names in the Files view: the lines selected in the item's viewer when there are some (pinned), else the
 * item (`filesItemLink`).
 */
export function filesShownLink(
  workspace: Pick<WorkspaceInfo, 'repository' | 'selector' | 'loadedChangeset'>,
  item: Pick<TreeItem, 'path' | 'repository'>,
  selected: { path: string; lines: LinkLines } | null,
  options: { changed?: boolean } = {},
): LinkTarget | null {
  const lines = selected?.path === item.path ? filesItemLink(workspace, item, selected.lines, options) : null;
  return lines ?? filesItemLink(workspace, item);
}

/** What the workspace is on, as a link names it; none for a shelve, which a link can't browse. */
function workspaceObject({ selector, loadedChangeset }: Pick<WorkspaceInfo, 'selector' | 'loadedChangeset'>): LinkObject | null {
  switch (selector.kind) {
    case 'branch':
      return { kind: 'branch', name: selector.name };
    case 'label':
      return { kind: 'label', name: selector.name };
    case 'changeset':
      return loadedChangeset === null ? null : { kind: 'changeset', id: loadedChangeset };
    case 'shelve':
      return null;
  }
}
