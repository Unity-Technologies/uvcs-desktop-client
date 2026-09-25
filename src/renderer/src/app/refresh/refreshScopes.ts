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
const UNTOUCHED_BY_CHECKINS = ['labels', 'shelves', 'attributeTypes', 'attributeUsedValues', 'codeReviews', 'leftChanges'];

/** A checkin from this workspace: everything but the objects checkins don't create or change. */
export function isAffectedByOwnCheckin(key: QueryKey): boolean {
  return !UNTOUCHED_BY_CHECKINS.includes(area(key) as string);
}

/** Changes were shelved, and stay in the workspace: only the lists of shelves change. */
export function isAffectedByShelving(key: QueryKey): boolean {
  return area(key) === 'shelves';
}

/**
 * New changesets on the server: repository views (history, branches, incoming...), not the disk, the check that told,
 * nor the lists of objects checkins don't create (every label or shelve is a heavy read on big repositories).
 */
export function isAffectedByNewChangesets(key: QueryKey): boolean {
  if ((LOCAL_AREAS as readonly unknown[]).includes(area(key)) || area(key) === 'content') return false;
  if (UNTOUCHED_BY_CHECKINS.includes(area(key) as string)) return false;
  return !(area(key) === 'incoming' && detail(key) === 'summary');
}
