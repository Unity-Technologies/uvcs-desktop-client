import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';

export type ChangeCategory = 'changed' | 'added' | 'deleted' | 'moved' | 'private' | 'ignored' | 'cloaked' | 'hidden';

/** Kinds that put a change in each category; earlier categories in `CATEGORY_PRECEDENCE` win. */
const CATEGORY_KINDS: Record<ChangeCategory, ChangeKind[]> = {
  added: ['added', 'copied'],
  deleted: ['deleted', 'locallyDeleted'],
  moved: ['moved', 'locallyMoved'],
  changed: ['checkedOut', 'changed', 'replaced'],
  private: ['private'],
  ignored: ['ignored'],
  cloaked: ['cloaked'],
  hidden: ['hiddenChanged'],
};

const CATEGORY_PRECEDENCE: ChangeCategory[] = ['added', 'deleted', 'moved', 'changed', 'private', 'ignored', 'cloaked', 'hidden'];

export function categoryOf(change: PendingChange): ChangeCategory {
  return CATEGORY_PRECEDENCE.find((category) => CATEGORY_KINDS[category].some((kind) => change.kinds.includes(kind))) ?? 'changed';
}

/** Whether the file content differs from the loaded revision (as opposed to only being moved, added...). */
export function hasContentChanges(change: PendingChange): boolean {
  return change.kinds.includes('changed') || change.kinds.includes('replaced');
}

/** Whether the item is in the workspace on disk, so it can be opened or revealed. */
export function existsOnDisk(change: PendingChange): boolean {
  return !change.kinds.includes('deleted') && !change.kinds.includes('locallyDeleted');
}

/** Private, ignored and cloaked items are not under version control (yet). */
export function isControlled(change: PendingChange): boolean {
  return !['private', 'ignored', 'cloaked'].includes(categoryOf(change));
}

/** Whether the workspace is its branch but for files never checked in (private, ignored, cloaked). */
export function matchesBranch(changes: PendingChange[]): boolean {
  return !changes.some(isControlled);
}

/**
 * Whether a shelve can take the change: `cm shelveset create` shelves only what is under version control, and follows
 * a link it is given to the file it points to (it has no `--symlink`).
 */
export function isShelvable(change: PendingChange): boolean {
  return isControlled(change) && change.itemType !== 'symlink';
}

/** Whether the item has revisions to show (history, annotations): added and copied items get their first at checkin. */
export function hasRevisions(change: PendingChange): boolean {
  return isControlled(change) && categoryOf(change) !== 'added';
}

/** Changes that are checked in by default. Ignored, cloaked and hidden files are only shown for reference. */
export function isCheckinCandidate(change: PendingChange): boolean {
  return !['ignored', 'cloaked', 'hidden'].includes(categoryOf(change));
}

export const KIND_LABELS: Record<ChangeKind, string> = {
  added: 'Added',
  checkedOut: 'Checked out',
  changed: 'Changed',
  copied: 'Copied',
  replaced: 'Replaced',
  deleted: 'Deleted',
  locallyDeleted: 'Deleted locally',
  moved: 'Moved',
  locallyMoved: 'Moved locally',
  private: 'Private',
  ignored: 'Ignored',
  cloaked: 'Cloaked',
  hiddenChanged: 'Hidden change',
};

export function describeKinds(change: PendingChange): string {
  return change.kinds.map((kind) => KIND_LABELS[kind]).join(', ');
}
