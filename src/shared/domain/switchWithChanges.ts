/** What happens to pending changes when the workspace switches: they stay behind in a shelve, or come along. */
export type PendingChangesAction = 'leave' | 'bring';

/** The setting: ask every time, or always do the same. */
export type PendingChangesOnSwitch = 'ask' | PendingChangesAction;

/** Why the changes can't come along to the target. */
export type BringDisabledReason = 'label' | 'shelve' | 'otherRepository';

/** Why the changes can't stay behind. */
export type LeaveDisabledReason = 'shelveSource';

/** What the app knows about the workspace before switching it, to decide what to offer. */
export interface SwitchPreflight {
  /** What the workspace is on now, e.g. `/main/t1`, `changeset 12` or `label v1`. */
  sourceName: string;
  /** Pending changes that would be shelved (private files are not). */
  pendingCount: number;
  /** Private files: they are never shelved and stay in the folder. */
  privateCount: number;
  /** Every pending change is a checkout with no change, so undoing them loses nothing. */
  unchangedCheckoutsOnly: boolean;
  /** The workspace holds an unfinished merge. */
  inMerge: boolean;
  /** Pending paths the user holds locks on; undoing them for the switch releases the locks. */
  lockedPaths: string[];
  bringDisabledReason?: BringDisabledReason;
  leaveDisabledReason?: LeaveDisabledReason;
  /** Shelves already left on the source; leaving again creates a new one next to them. */
  leftShelveCount: number;
}

export type SwitchResult = (
  | { kind: 'switched'; restored?: RestoredChanges }
  | { kind: 'undidUnchangedCheckouts'; count: number; restored?: RestoredChanges }
  | { kind: 'left'; shelveId: number; count: number; sourceName: string; restored?: RestoredChanges }
  | { kind: 'brought' }
  /** Switched, but the changes wait in the shelve until the user resolves how they merge on the target. */
  | { kind: 'bringPending'; shelveId: number; conflictCount: number }
) & { renamedPrivates?: RenamedPrivateFile[] };

/** A private file in the way of a file the switch wrote: `cm` kept it next to it, under another name. */
export interface RenamedPrivateFile {
  /** Workspace path, e.g. `src/a.txt`. */
  path: string;
  /** e.g. `src/a.txt.private.0`. */
  renamedTo: string;
}

/** Changes left on the target earlier and restored automatically on arrival. */
export interface RestoredChanges {
  count: number;
}

/** A changelist and the pending paths it held when its changes were shelved. */
export interface ShelvedChangelist {
  name: string;
  description: string;
  paths: string[];
}

/** An automatic shelve the app created while switching, kept in the app settings until it is restored or discarded. */
export interface SwitchShelveRecord {
  workspaceGuid: string;
  shelveId: number;
  repository: string;
  /** Where the changes were made: the selector spec (`br:/main/t1`), its display name and its object reference (`br:29`). */
  source: { spec: string; name: string; objectRef: string };
  target: { spec: string; name: string };
  mode: PendingChangesAction;
  /** Set when the changes were put aside to update, or shelved away by the user (see `ShelvedChangesReason`); absent: a switch. */
  reason?: ShelvedChangesReason;
  createdAt: string;
  /** Workspace paths in the shelve. */
  paths: string[];
  changelists: ShelvedChangelist[];
  /** Added files that became private when the changes were undone, moved aside so they don't leak into the target. */
  backup?: { directory: string; paths: string[] };
}

/**
 * Why the app shelved changes: to switch away, to update past incoming changesets that deleted or moved
 * files changed locally (`cm update` can't merge those), or because the user shelved them away (Shelve undoes what it
 * shelves). Only the first two are left changes, offered by "Welcome back"; all of them are put back the same way.
 */
export type ShelvedChangesReason = 'switch' | 'update' | 'shelve';

/** Shelved changes waiting for the user on the workspace's current selector. */
export interface LeftChanges {
  shelveId: number;
  /** Where the changes were made, e.g. `/main/t1`. */
  sourceName: string;
  /** Where the workspace switched to when they were shelved; unknown for shelves left by another app. */
  targetName?: string;
  mode: PendingChangesAction;
  reason: Exclude<ShelvedChangesReason, 'shelve'>;
  count: number;
  createdAt: string;
  /** Left by another workspace or app (the official client, `cm switch`). */
  foreign: boolean;
}

export type RestoreResult =
  | { kind: 'restored'; count: number; sourceName: string }
  | { kind: 'conflicts'; shelveId: number }
  | { kind: 'pendingChanges' };
