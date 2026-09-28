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

export type MergeChangeKind = 'added' | 'deleted' | 'moved' | 'changed' | 'permissions';

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
  /** Repository path on the destination, e.g. `/src/app.ts`. */
  path: string;
  itemId: number;
  baseChangeset: number;
  sourceChangeset: number;
  destinationChangeset: number;
  /**
   * The repository the item id and the changesets belong to: the merged one, or for a file under a writable xlink the
   * xlinked one, where the same numbers are another item and other changesets.
   */
  repository: string;
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
  | { choice: 'source' }
  | { choice: 'destination' }
  /** The merged text written by the user or merged automatically. */
  | { choice: 'text'; text: string };

export interface MergeResolutions {
  /** One per directory conflict, in the plan's order. */
  directoryConflicts: DirectoryConflictResolution[];
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

/** Directory conflicts where keeping both items under a new name is possible. */
export const RENAMEABLE_CONFLICTS: ReadonlySet<DirectoryConflictType> = new Set(['evilTwin', 'movedEvilTwin', 'addMove', 'moveAdd']);
