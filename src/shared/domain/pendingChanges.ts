import type { MergeLinkType } from './branchExplorer';

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
  /** The changelist the change belongs to; undefined for the default changelist. */
  changelist?: string;
}

export interface Changelist {
  name: string;
  description: string;
}

export interface PendingChangesSnapshot {
  changes: PendingChange[];
  /** User changelists (the default one is implicit). */
  changelists: Changelist[];
  loadedChangeset: number;
  /** The merges the changes come from, each once: checking in records them as merge links. */
  mergeLinks: PendingMergeLink[];
}

/** A merge (or cherry pick, subtractive, interval) done in the workspace and not checked in yet. */
export interface PendingMergeLink {
  type: MergeLinkType;
  sourceChangeset: number;
  /** Where an interval starts (it takes the changesets after it, up to the source); undefined for the rest. */
  intervalStart?: number;
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

/**
 * A checkout without edits (`cm status --iscochanged` reads it `CO`, not `CO+CH`): checking it in or undoing it only
 * releases the item.
 */
export function isUnchangedCheckout(change: PendingChange): boolean {
  return change.kinds.length > 0 && change.kinds.every((kind) => kind === 'checkedOut');
}

export interface CheckinRequest {
  paths: string[];
  comment: string;
}

/**
 * What `cm checkin` did: the changeset it created, or none (`noChanges`) when nothing was left to record. Before
 * recording, it undoes the checkouts whose content is the loaded revision's, so checking in only those releases them.
 */
export type CheckinResult = { kind: 'created'; changesetId: number; branch: string } | { kind: 'noChanges' };

export type FilterRuleList = 'ignore' | 'cloaked' | 'hidden';
