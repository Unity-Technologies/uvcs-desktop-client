export interface WorkspaceSummary {
  name: string;
  path: string;
  guid: string;
}

export type SelectorKind = 'branch' | 'changeset' | 'label' | 'shelve';

/** What the workspace is currently loaded from: a branch, a changeset, a label or a shelve. */
export interface WorkspaceSelector {
  kind: SelectorKind;
  /** Branch or label name, or the changeset / shelve number as text. */
  name: string;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  repository: string;
  repositoryName: string;
  server: string;
  selector: WorkspaceSelector;
  loadedChangeset: number;
}

/** Whether a folder can hold a new workspace: `available` when it doesn't exist or is empty. */
export type NewFolderCheck = 'available' | 'notEmpty' | 'notAFolder';
