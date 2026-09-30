/**
 * Which workspace queries each kind of change makes stale. Workspace query keys are
 * `['workspace', path, area, ...details]` (`queryKeys.inWorkspace`); these predicates read the area and details.
 */
type QueryKey = readonly unknown[];

const area = (key: QueryKey) => key[2];
const detail = (key: QueryKey) => key[3];

/** What the disk holds, rather than the server: the watcher keeps it fresh, so window focus doesn't need to. */
export const LOCAL_AREAS = ['pendingChanges', 'info', 'explorer', 'review'] as const;

/** Workspace files changed: pending changes, review marks, the files view and open diffs of workspace files. */
export function isAffectedByFileChanges(key: QueryKey): boolean {
  if (area(key) === 'pendingChanges' || area(key) === 'review') return true;
  if (area(key) === 'explorer') return detail(key) === 'directory' || detail(key) === 'details';
  if (area(key) === 'diffContents') return isWorkspaceFile(key[3]) || isWorkspaceFile(key[4]);
  return area(key) === 'content' && isWorkspaceFile(detail(key));
}

/**
 * Files changed in these folders (null: anywhere): what `isAffectedByFileChanges` refreshes, but of the Files view only
 * the listings of those folders and of the ones above them (a folder's row tells what it holds), and the details of
 * those folders and of their items. With hundreds of folders open, an edit re-reads a few listings, not all of them.
 */
export function isAffectedByFileChangesIn(folders: readonly string[] | null): (key: QueryKey) => boolean {
  if (folders === null) return isAffectedByFileChanges;
  const holdsChanges = (directory: string) => folders.some((folder) => isSameOrInside(folder, directory));
  return (key) => {
    if (area(key) !== 'explorer') return isAffectedByFileChanges(key);
    const path = key[4] as string;
    if (detail(key) === 'directory') return holdsChanges(path);
    if (detail(key) === 'details') return holdsChanges(path) || folders.includes(path.slice(0, Math.max(0, path.lastIndexOf('/'))));
    return false;
  };
}

/** Whether `path` is `folder` or inside it (`''` is the workspace root). */
function isSameOrInside(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}

function isWorkspaceFile(source: unknown): boolean {
  return (source as { kind?: string } | undefined)?.kind === 'workspaceFile';
}

/** Items came or went: the "go to file" list of every path. */
export function isAffectedByMovedPaths(key: QueryKey): boolean {
  return area(key) === 'explorer' && detail(key) === 'allPaths';
}

/** `cm` rewrote `.plastic`: what is checked out, added or in a changelist, and possibly what is loaded. */
export function isAffectedByWorkspaceState(key: QueryKey): boolean {
  return area(key) === 'pendingChanges' || area(key) === 'info';
}

/** The workspace loads another changeset or branch: everything but the workspace info that told. */
export function isAffectedByLoadedChangeset(key: QueryKey): boolean {
  return area(key) !== 'info';
}

/** Repository objects a checkin by someone else doesn't touch. */
const UNTOUCHED_BY_CHECKINS = ['labels', 'shelves', 'attributeTypes', 'attributeValues', 'attributeUsedValues', 'codeReviews', 'leftChanges'];

/**
 * This workspace checked in, updated, or merged from a branch or changeset: everything but the objects those leave
 * alone, and changesets already read (only editing a comment changes one).
 */
export function isAffectedByCheckinOrUpdate(key: QueryKey): boolean {
  if (area(key) === 'changesets' && detail(key) === 'byId') return false;
  return !UNTOUCHED_BY_CHECKINS.includes(area(key) as string);
}

/** A branch was created, deleted, hidden or shown again: the lists of branches, not what the workspace has loaded. */
export function isAffectedByBranchList(key: QueryKey): boolean {
  return area(key) === 'branches' || area(key) === 'branchExplorer';
}

/** A label was created, renamed, deleted or described: the lists of labels, the graph, and the workspace if it's on one. */
export function isAffectedByLabels(key: QueryKey): boolean {
  return area(key) === 'labels' || area(key) === 'branchExplorer' || area(key) === 'info';
}

/** An attribute or one of its values changed: only what shows attributes, which is nothing but them. */
export function isAffectedByAttributes(key: QueryKey): boolean {
  return area(key) === 'attributeTypes' || area(key) === 'attributeValues' || area(key) === 'attributeUsedValues';
}

/** A code review was created, edited or deleted: the lists of reviews and the branch chips, which read the same list. */
export function isAffectedByCodeReviews(key: QueryKey): boolean {
  return area(key) === 'codeReviews';
}

/** Locks were released or removed: the Locks view and the lock marks of pending changes, which read the same locks. */
export function isAffectedByLocks(key: QueryKey): boolean {
  return area(key) === 'locks';
}

/** Changes were shelved, and stay in the workspace: only the lists of shelves change. */
export function isAffectedByShelving(key: QueryKey): boolean {
  return area(key) === 'shelves';
}

/** Shelves were deleted: the lists of shelves and the left changes, which offer shelves back. */
export function isAffectedByShelveDeletion(key: QueryKey): boolean {
  return area(key) === 'shelves' || area(key) === 'leftChanges';
}

/**
 * Changes were shelved and undone: the lists of shelves, and the workspace as undoing leaves it (its files, the items
 * the changes added, what is checked out).
 */
export function isAffectedByShelvingAway(key: QueryKey): boolean {
  return isAffectedByShelving(key) || isAffectedByWorkspaceEdit(key);
}

/**
 * A shelve was applied to the workspace, or restored (applied and deleted): the workspace as the merge leaves it, the
 * locks its checkouts take, the lists of shelves and the left changes that offered it.
 */
export function isAffectedByShelveApplied(key: QueryKey): boolean {
  return isAffectedByPendingChangeEdit(key) || isAffectedByShelveDeletion(key);
}

/** Files were added, checked out, removed or undone: the workspace, and the locks a checkout takes or an undo lets go. */
export function isAffectedByPendingChangeEdit(key: QueryKey): boolean {
  return isAffectedByWorkspaceEdit(key) || isAffectedByLocks(key);
}

/** The workspace's files, the items that came or went, and what is checked out, added or moved. */
function isAffectedByWorkspaceEdit(key: QueryKey): boolean {
  return isAffectedByFileChanges(key) || isAffectedByMovedPaths(key) || isAffectedByWorkspaceState(key);
}

/**
 * New changesets on the server: repository views (history, branches, incoming...), not the disk, the check that told,
 * nor the lists of objects checkins don't create (every label or shelve is a heavy read on big repositories).
 */
export function isAffectedByNewChangesets(key: QueryKey): boolean {
  if ((LOCAL_AREAS as readonly unknown[]).includes(area(key)) || area(key) === 'content') return false;
  // The workspace's own version of a file (no revision spec) changes with the workspace, not with others' checkins.
  if (area(key) === 'annotate' && key[4] == null) return false;
  if (UNTOUCHED_BY_CHECKINS.includes(area(key) as string)) return false;
  return !(area(key) === 'incoming' && detail(key) === 'summary');
}
