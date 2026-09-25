import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';

export type ChangeCategory = 'changed' | 'added' | 'deleted' | 'moved' | 'private' | 'ignored' | 'cloaked' | 'hidden';

interface CategoryInfo {
  label: string;
  /** Kinds that put a change in this category; earlier categories win. */
  kinds: ChangeKind[];
}

export const CATEGORIES: Record<ChangeCategory, CategoryInfo> = {
  added: { label: 'Added', kinds: ['added', 'copied'] },
  deleted: { label: 'Deleted', kinds: ['deleted', 'locallyDeleted'] },
  moved: { label: 'Moved', kinds: ['moved', 'locallyMoved'] },
  changed: { label: 'Changed', kinds: ['checkedOut', 'changed', 'replaced'] },
  private: { label: 'Private', kinds: ['private'] },
  ignored: { label: 'Ignored', kinds: ['ignored'] },
  cloaked: { label: 'Cloaked', kinds: ['cloaked'] },
  hidden: { label: 'Hidden changes', kinds: ['hiddenChanged'] },
};

/** The order categories are shown in. */
export const CATEGORY_ORDER: ChangeCategory[] = ['changed', 'added', 'deleted', 'moved', 'private', 'ignored', 'cloaked', 'hidden'];

const CATEGORY_PRECEDENCE: ChangeCategory[] = ['added', 'deleted', 'moved', 'changed', 'private', 'ignored', 'cloaked', 'hidden'];

export function categoryOf(change: PendingChange): ChangeCategory {
  return CATEGORY_PRECEDENCE.find((category) => CATEGORIES[category].kinds.some((kind) => change.kinds.includes(kind))) ?? 'changed';
}

/** Whether the file content differs from the loaded revision (as opposed to only being moved, added...). */
export function hasContentChanges(change: PendingChange): boolean {
  return change.kinds.includes('changed') || change.kinds.includes('replaced');
}

/** Private, ignored and cloaked items are not under version control (yet). */
export function isControlled(change: PendingChange): boolean {
  return !['private', 'ignored', 'cloaked'].includes(categoryOf(change));
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
