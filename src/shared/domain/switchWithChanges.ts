import type { ShelveGuid } from './stableIds';
import type { SelectorKind } from './workspace';

/** What happens to pending changes shelved by a switch: they stay behind in the shelve, or come along. */
export type PendingChangesAction = 'leave' | 'bring';

/**
 * What a switch does with the pending changes: shelve them (`PendingChangesAction`), or undo them, losing them
 * (`discard`). Discarding is only ever chosen in the switch dialog: no setting does it without asking.
 */
export type SwitchChangesAction = PendingChangesAction | 'discard';

/**
 * What a partial workspace does with its pending changes as it downloads its whole branch: they stay on that branch,
 * so they come along or are undone, never left behind on a shelve.
 */
export type WholeBranchChangesAction = Exclude<SwitchChangesAction, 'leave'>;

/** The setting: ask every time, or always do the same. */
export type PendingChangesOnSwitch = 'ask' | PendingChangesAction;

/** Why the changes can't come along to the target. */
export type BringDisabledReason = 'label' | 'shelve' | 'otherRepository';

/** Why the changes can't stay behind. */
export type LeaveDisabledReason = 'shelveSource';

/**
 * Why a partial workspace can't switch to a target: `cm partial switch` only takes a branch or a changeset of its own
 * repository. The target's kind names what was refused: a label or a shelve, or anything of another repository.
 */
export type PartialSwitchDisabledReason = Exclude<SelectorKind, 'branch' | 'changeset'> | 'otherRepository';

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
  /** The changes were undone before switching, as the user chose: they are gone. */
  | { kind: 'discarded'; count: number; restored?: RestoredChanges }
  /**
   * Switched, but the changes wait in the shelve until the user resolves how they merge on the target. `mergesHere` is
   * false in a partial workspace, which can't take a merge: the shelve merges in a standard workspace.
   */
  | { kind: 'bringPending'; shelveId: number; conflictCount: number; mergesHere: boolean }
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

/**
 * An automatic shelve the app created while switching, kept in the app settings until it is restored or discarded.
 * What a rename changes (a branch's spec, the repository's name) is followed by what it never changes: the workspace's
 * GUID, a branch's object id, the shelve's GUID (`LeftChangesFinder`).
 */
export interface SwitchShelveRecord {
  workspaceGuid: string;
  shelveId: number;
  /** `name@server`, as it was named when last seen. */
  repository: string;
  /** The shelve's GUID, learned the first time the shelve is listed (`cm find shelve`); absent until then. */
  shelveGuid?: ShelveGuid;
  /**
   * Where the changes were made: the selector spec (`br:/main/t1`) and display name as last seen, and its object
   * reference (`br:29`), which a rename keeps.
   */
  source: { spec: string; name: string; objectRef: string };
  /** Where they went; its object reference once the workspace was seen on it, its id known (a branch's renamed later is followed). */
  target: { spec: string; name: string; objectRef?: string };
  mode: PendingChangesAction;
  /** Set when the changes were put aside to update or to load an xlink, or shelved away by the user (see `ShelvedChangesReason`); absent: a switch. */
  reason?: ShelvedChangesReason;
  createdAt: string;
  /** Workspace paths in the shelve. */
  paths: string[];
  changelists: ShelvedChangelist[];
  /** Added files that became private when the changes were undone, moved aside so they don't leak into the target. */
  backup?: { directory: string; paths: string[] };
}

/**
 * Why the app shelved changes: to switch away, to update past incoming changesets that deleted or moved files changed
 * locally (`cm update` can't merge those), to load an xlink's files, which `cm` may refuse with changes pending
 * (`loadXlink`), or because the user shelved them away (Shelve undoes what it shelves). All but the last are left
 * changes, offered by "Welcome back"; all of them are put back the same way.
 */
type ShelvedChangesReason = 'switch' | 'update' | 'xlink' | 'shelve';

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

/**
 * A file moved aside while its changes were shelved that couldn't go back: another item is at its path now. It stays
 * in the app's data folder, at `savedAt`.
 */
export interface KeptAsideFile {
  /** Where it was in the workspace (workspace-relative, `/`-separated). */
  path: string;
  savedAt: string;
}
