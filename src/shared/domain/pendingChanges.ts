export type ChangeKind =
  | 'added'
  | 'checkedOut'
  | 'changed'
  | 'copied'
  | 'replaced'
  | 'deleted'
  | 'locallyDeleted'
  | 'moved'
  | 'locallyMoved'
  | 'private'
  | 'ignored'
  | 'cloaked'
  | 'hiddenChanged';

export type ItemType = 'file' | 'binaryFile' | 'directory' | 'symlink' | 'xlink';

export interface PendingChange {
  /** Workspace-relative path using forward slashes, e.g. `src/app.ts`. */
  path: string;
  /** Previous path for moved items. */
  oldPath?: string;
  /** All the states of the item; an item can be moved and changed at the same time. */
  kinds: ChangeKind[];
  itemType: ItemType;
  size: number;
  lastModified: string;
  /** e.g. `Merge from 2`, when the change comes from a pending merge. */
  mergeInfo?: string;
  similarityPercent?: number;
}

export interface PendingChangesSnapshot {
  changes: PendingChange[];
  loadedChangeset: number;
}

export interface PendingChangesFilter {
  showPrivate: boolean;
  showIgnored: boolean;
  showCloaked: boolean;
  showHiddenChanged: boolean;
  detectLocalMoves: boolean;
  /** Minimum similarity for the local-move detection. */
  moveSimilarityPercent: number;
}

export const DEFAULT_PENDING_CHANGES_FILTER: PendingChangesFilter = {
  showPrivate: true,
  showIgnored: false,
  showCloaked: false,
  showHiddenChanged: false,
  detectLocalMoves: true,
  moveSimilarityPercent: 20,
};

export interface CheckinRequest {
  paths: string[];
  comment: string;
}

export interface CheckinResult {
  changesetId: number;
  branch: string;
}

export type FilterRuleList = 'ignore' | 'cloaked' | 'hidden';
