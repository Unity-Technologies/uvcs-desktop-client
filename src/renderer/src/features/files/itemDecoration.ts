import type { TreeItem } from '@shared/domain/explorer';
import type { ItemPresence } from '../../components/ItemRow';
import type { ItemStatus } from './itemStatus';

const PRIVATE: ItemStatus = { tone: 'private', label: 'Private' };

export interface ItemDecoration {
  /** The status letter at the end of the row, as in Changes: only for what is notable (a pending change, a checkout). */
  status: ItemStatus | null;
  presence: ItemPresence;
}

/**
 * How the tree marks an item. Most items of a workspace are controlled and up to date, so marking them (the desktop
 * GUI's check on every icon) would hide the few that changed: only those get their letter. Private items get their
 * quiet P, as in Changes, so they read apart from controlled files at a glance; ignored ones grey out instead.
 */
export function itemDecoration(item: Pick<TreeItem, 'isPrivate'>, status: ItemStatus | null): ItemDecoration {
  if (status?.tone === 'muted') return { status: null, presence: 'ignored' };
  if (status?.tone === 'private' || (!status && item.isPrivate)) return { status: PRIVATE, presence: 'private' };
  return { status, presence: 'controlled' };
}
