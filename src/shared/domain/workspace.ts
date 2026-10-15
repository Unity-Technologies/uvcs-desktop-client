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

/** What a workspace works on, as its selector file says: `cm` reads and rewrites it, the app only reads it. */
export interface WorkspaceHead {
  /** `name@server`; null when the file names its server by an id people never see (a Unity organization's). */
  repository: string | null;
  /** The repository's own name, which the file always tells. */
  repositoryName: string;
  /** Null when the file loads something the app doesn't name (e.g. a custom selector). */
  selector: WorkspaceSelector | null;
}

/**
 * Another workspace at a glance: what it's loaded from and how many pending changes it has. Its repository is the
 * one its row already shows (`WorkspaceHead`).
 */
export interface WorkspaceGlance {
  selector: WorkspaceSelector;
  pendingCount: number;
}

/** Whether a folder can hold a new workspace: `available` when it doesn't exist or is empty. */
export type NewFolderCheck = 'available' | 'notEmpty' | 'notAFolder';
