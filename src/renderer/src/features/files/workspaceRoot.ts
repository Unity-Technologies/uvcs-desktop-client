import type { TreeItem } from '@shared/domain/explorer';
import type { WorkspaceInfo } from '@shared/domain/workspace';

/** The top row of the Files tree, as in the Plastic desktop GUI: the workspace folder itself, named by its full path. */
export function workspaceRootItem(workspace: Pick<WorkspaceInfo, 'path' | 'selector' | 'loadedChangeset'>): TreeItem {
  return {
    path: '',
    name: workspace.path,
    itemType: 'directory',
    size: 0,
    date: '',
    isPrivate: false,
    isCheckedOut: false,
    changeset: workspace.loadedChangeset,
    branch: workspace.selector.kind === 'branch' ? workspace.selector.name : '',
    owner: '',
    revisionId: 0,
    parentRevisionId: -1,
    itemId: 0,
  };
}

export function isWorkspaceRoot(item: Pick<TreeItem, 'path'>): boolean {
  return item.path === '';
}
