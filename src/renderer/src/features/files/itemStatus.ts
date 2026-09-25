import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { StatusTone } from '../../components/StatusBadge';
import { describeKinds } from '../pendingChanges/changeCategories';
import { changeTone } from '../pendingChanges/changeTone';

export interface ItemStatus {
  tone: StatusTone;
  label: string;
}

/** Indexes pending changes so the tree can look up each item's status quickly. */
export class PendingChangesIndex {
  private readonly byPath: Map<string, PendingChange>;
  private readonly directoriesWithChanges = new Set<string>();

  constructor(changes: PendingChange[]) {
    this.byPath = new Map(changes.map((change) => [change.path, change]));
    for (const change of changes) {
      const segments = change.path.split('/');
      for (let length = 1; length < segments.length; length++) this.directoriesWithChanges.add(segments.slice(0, length).join('/'));
    }
  }

  changeAt(path: string): PendingChange | undefined {
    return this.byPath.get(path);
  }

  hasChangesInside(directory: string): boolean {
    return this.directoriesWithChanges.has(directory);
  }
}

/** The status shown for a tree item: its own pending change, else private / checked out. */
export function itemStatus(item: TreeItem, index: PendingChangesIndex): ItemStatus | null {
  const change = index.changeAt(item.path);
  if (change) return { tone: changeTone(change), label: describeKinds(change) };
  if (item.isPrivate) return { tone: 'private', label: 'Private' };
  if (item.isCheckedOut) return { tone: 'changed', label: 'Checked out' };
  return null;
}

/**
 * The mark on an item's icon, as the Plastic desktop GUI overlays them: its pending status, else a link for an xlink,
 * private, or a check for an item under version control and up to date.
 */
export type IconOverlay = StatusTone | 'xlink' | 'controlled';

export function iconOverlay(item: Pick<TreeItem, 'isPrivate' | 'xlink'>, status: ItemStatus | null): IconOverlay {
  if (status) return status.tone;
  if (item.xlink) return 'xlink';
  return item.isPrivate ? 'private' : 'controlled';
}
