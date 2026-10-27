import { spec } from './specs';

export type MergeKind = 'merge' | 'cherryPick' | 'subtractive';

/** What to merge. Everything the merge view needs to preview and run it. */
export interface MergeRequest {
  kind: MergeKind;
  /** Branch, changeset, label or shelve spec, e.g. `br:/main/task`. */
  sourceSpec: string;
  /** For interval merges: the changeset the interval starts after. */
  intervalOriginSpec?: string;
  /** Merge into this branch on the server ("merge to") instead of into the workspace. */
  destinationBranch?: string;
  /** A shelve applied to the workspace and deleted once merged ("Apply and delete"). */
  deleteShelve?: boolean;
}

export interface MergeContributor {
  changesetId: number;
  branch: string;
}

export interface MergeContributors {
  source: MergeContributor;
  destination: MergeContributor;
  /** Missing for merges without a common ancestor. */
  base?: MergeContributor;
}

type MergeChangeKind = 'added' | 'deleted' | 'moved' | 'changed' | 'permissions';

/** A change from the source that applies cleanly to the destination. */
export interface MergeChange {
  kind: MergeChangeKind;
  /** Repository path, e.g. `/src/app.ts`. */
  path: string;
  /** Previous path of moved items. */
  oldPath?: string;
}

/** A file changed on both contributors. Its contents must be merged. */
export interface FileConflict {
  /** Repository path in the merge's result, e.g. `/src/app.ts`: where a directory decision may have moved it. */
  path: string;
  /**
   * Where the destination's tree has it, as the merge listed it before any directory decision: its versions are named
   * by it (and the workspace's copy found by it), so a decision moving the file reads none of them again.
   */
  destinationPath: string;
  itemId: number;
  baseChangeset: number;
  sourceChangeset: number;
  destinationChangeset: number;
  /**
   * The repository the item id and the changesets belong to: the merged one, or for a file under a writable xlink the
   * xlinked one, where the same numbers are another item and other changesets.
   */
  repository: string;
  /**
   * The destination's revision of the file, in `repository`: read by its id, from the workspace's disk where the
   * workspace's file has its content (`WorkspaceCopies`), else downloaded. None for a file conflict a directory
   * decision revealed where the destination's tree doesn't have it (moved there by the destination into a folder the
   * decision dropped): its version is read as the item at its changeset (`destinationVersionSpec`).
   */
  destinationRevisionId?: number;
  /**
   * `cm` keeps the destination's revision as a binary (its `cm ls` type): the file can't merge line by line whatever
   * its other versions hold, so the merge page reads none of its versions until the user opens it. False says nothing
   * about the other versions: they are read to tell.
   */
  destinationIsBinary: boolean;
}

export type DirectoryConflictType =
  | 'evilTwin'
  | 'movedEvilTwin'
  | 'changeDelete'
  | 'deleteChange'
  | 'moveDelete'
  | 'deleteMove'
  | 'divergentMove'
  | 'cycleMove'
  | 'loadedTwice'
  | 'addMove'
  | 'moveAdd'
  | 'xlink';

export type ItemOperation = 'added' | 'deleted' | 'moved' | 'changed';

/** What one contributor did to the item in conflict. */
export interface ConflictSide {
  operation: ItemOperation;
  path: string;
  /** The original path, for moves. */
  oldPath?: string;
  /** Human readable, e.g. "Moved from /a to /b". */
  description: string;
}

/** Both contributors changed the directory structure in incompatible ways (moves, deletes, adds...). */
export interface DirectoryConflict {
  type: DirectoryConflictType;
  title: string;
  explanation: string;
  itemId: number;
  isDirectory: boolean;
  source: ConflictSide;
  destination: ConflictSide;
}

export type MergePlanStatus =
  | 'ready'
  /** Everything in the source is already in the destination. */
  | 'alreadyMerged'
  | 'invalidInterval'
  /** The workspace has pending changes; `cm` refuses to merge until they are checked in or shelved. */
  | 'pendingChanges';

export interface MergePlan {
  status: MergePlanStatus;
  contributors?: MergeContributors;
  /** The merged repository, as the destination contributor names it (`game@local`). */
  repository?: string;
  changes: MergeChange[];
  fileConflicts: FileConflict[];
  directoryConflicts: DirectoryConflict[];
  warnings: string[];
}

export type DirectoryConflictResolution =
  | { choice: 'source' }
  | { choice: 'destination' }
  /** Keep both items, renaming the destination one. Only for conflicts where two items collide. */
  | { choice: 'rename'; newName: string };

export type FileConflictResolution =
  /**
   * Keep the source's version. `text`: that version as the merge page read it, when writing it gives back its very
   * bytes (a text file in UTF-8): the merge writes it instead of asking `cm` for it again. Without it, `cm cat` does.
   */
  | { choice: 'source'; text?: string }
  | { choice: 'destination' }
  /**
   * Keep the common ancestor's version, which neither side has any more: only a file with a base. `text` as for the
   * source; without it, `cm cat` saves the base's revision.
   */
  | { choice: 'base'; text?: string }
  /** The merged text written by the user or merged automatically. */
  | { choice: 'text'; text: string };

/** A directory conflict the user decided: the conflict as the merge listed it, and how to resolve it. */
export interface DirectoryDecision {
  conflict: DirectoryConflict;
  resolution: DirectoryConflictResolution;
}

/**
 * A merge after the user's directory decisions, applied as they're made (`decideDirectoryConflicts`): the plan `cm`
 * calculated again on them, where a decision may have moved, removed or added file conflicts and changes, and the
 * decisions it took, in the order they apply.
 */
export interface DecidedMerge {
  plan: MergePlan;
  decisions: DirectoryDecision[];
}

export interface MergeResolutions {
  /**
   * The merge page's directory decisions (`decideDirectoryConflicts`), applied already: the merge goes on from them.
   * None while the merge has no directory conflict decided.
   */
  directoryDecisionsId?: string;
  /** Keyed by file conflict path. Every file conflict needs one. */
  files: Record<string, FileConflictResolution>;
  /** Changeset comment, for merges into a branch on the server. */
  comment?: string;
}

export interface MergeResult {
  /** The changeset created by a server-side merge. Workspace merges leave pending changes instead. */
  changesetId?: number;
  /**
   * Someone checked in on the destination branch while the server-side merge ran. Its changeset was left beside
   * the new head: merge it into the branch (`followUpMerge`) to finish.
   */
  destinationMoved?: boolean;
  /**
   * A workspace merge's conflicting files, by their plan path, that still hold the destination's version: the version
   * the user kept (incoming, or the base) couldn't be saved after `cm merge` ran (`runMerge`).
   */
  keptVersionNotSaved?: string[];
  /** Files whose kept version may not have been saved: `cm` failed without telling which, twice. */
  keptVersionMaybeNotSaved?: string[];
}

/** The merge that finishes a server-side merge whose destination moved: its changeset into the branch. */
export function followUpMerge(result: MergeResult, destinationBranch: string): MergeRequest {
  return { kind: 'merge', sourceSpec: `cs:${result.changesetId}`, destinationBranch };
}

/**
 * Where the source contents of a merge live. `cm` reports a shelve's changeset as a negative number,
 * so shelve merges read the source from the shelve itself.
 */
export function mergeSourcePoint(request: MergeRequest, sourceChangeset: number): string {
  return request.sourceSpec.startsWith('sh:') ? request.sourceSpec : `cs:${sourceChangeset}`;
}

// The specs a conflicting file's versions are read and saved by, the same for the merge page and the merge: the item
// at a contributor's point, in the repository the plan names for it (an xlinked one's own, where the same numbers are
// another item).

/** The incoming version: the item at the source's changeset, or a shelve's in the shelve. */
export function sourceVersionSpec(request: MergeRequest, conflict: FileConflict): string {
  return spec.itemAt(conflict.itemId, mergeSourcePoint(request, conflict.sourceChangeset), conflict.repository);
}

/** The destination's version by its item, for a file conflict the plan names no destination revision of. */
export function destinationVersionSpec(conflict: FileConflict): string {
  return spec.itemAt(conflict.itemId, spec.changeset(conflict.destinationChangeset), conflict.repository);
}

/** The common ancestor's version: the item at the base's changeset. Only for a file with a base (`hasMergeBase`). */
export function baseVersionSpec(conflict: FileConflict): string {
  return spec.itemAt(conflict.itemId, spec.changeset(conflict.baseChangeset), conflict.repository);
}

/** A file added on both sides has no common ancestor: `cm` prints a negative base changeset for it. */
export function hasMergeBase(conflict: FileConflict): boolean {
  return conflict.baseChangeset >= 0;
}

/**
 * Whether "Keep both" takes `newName` for the destination's item: one name, never a path (no `/` or `\`), `.` or `..`.
 * The merge page applies it only then, and the main process refuses anything else (`assertDecisionValid`).
 */
export function isValidRenameName(newName: string): boolean {
  return newName.trim() !== '' && !/[\\/]/.test(newName) && newName !== '.' && newName !== '..';
}

/** Directory conflicts where keeping both items under a new name is possible. */
export const RENAMEABLE_CONFLICTS: ReadonlySet<DirectoryConflictType> = new Set(['evilTwin', 'movedEvilTwin', 'addMove', 'moveAdd']);
