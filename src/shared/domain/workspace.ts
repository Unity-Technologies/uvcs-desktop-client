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
  /**
   * The changeset the workspace has loaded; null on a shelve, whose tree is no changeset of the repository (`cm`
   * numbers it as changeset `-id`, never a changeset to query from): the selector names the shelve.
   */
  loadedChangeset: number | null;
}

/** What a workspace works on, as `cm wi` tells it without asking the server. */
export interface WorkspaceHead {
  /** `name@server`; null when `cm` names its server only by an id people never see (a Unity organization's). */
  repository: string | null;
  /** The repository's own name, which `cm` always tells. */
  repositoryName: string;
  /** Null when it works on something the app doesn't name. */
  selector: WorkspaceSelector | null;
}

/**
 * Another workspace at a glance: what it's loaded from and how many pending changes it has. Its repository is the
 * one its row already shows (`WorkspaceHead`).
 */
export interface WorkspaceGlance {
  selector: WorkspaceSelector;
  /** Null when they couldn't be counted. */
  pendingCount: number | null;
}

/** Where an item is in the workspace holding it: the workspace's root as `cm` names it, and the item's path there. */
export interface WorkspaceLocation {
  root: string;
  /** Relative to the root with forward slashes (`Assets/Player.cs`), as the app names items; '' for the root itself. */
  itemPath: string;
}

/** Whether a folder can hold a new workspace: `available` when it doesn't exist or is empty. */
export type NewFolderCheck = 'available' | 'notEmpty' | 'notAFolder';
