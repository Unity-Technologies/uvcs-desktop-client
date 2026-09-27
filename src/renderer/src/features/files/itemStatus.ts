import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { StatusTone } from '../../components/StatusBadge';
import { describeKinds, existsOnDisk } from '../pendingChanges/changeCategories';
import { changeTone } from '../pendingChanges/changeTone';

export interface ItemStatus {
  tone: StatusTone;
  label: string;
  /** The file as it is on disk, for a file with a pending change: `cm ls` reports its loaded revision (0 bytes once added). */
  onDisk?: { size: number; date: string };
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
  if (change) {
    const status = { tone: changeTone(change), label: describeKinds(change) };
    const onDisk = onDiskState(item, change);
    return onDisk ? { ...status, onDisk } : status;
  }
  if (item.isPrivate) return { tone: 'private', label: 'Private' };
  if (item.isCheckedOut) return { tone: 'changed', label: 'Checked out' };
  return null;
}

/** A file's size and date on disk, from its pending change; undefined for folders and files it deletes. */
export function onDiskState(item: Pick<TreeItem, 'itemType'>, change: PendingChange): ItemStatus['onDisk'] {
  return item.itemType !== 'directory' && existsOnDisk(change) ? { size: change.size, date: change.lastModified } : undefined;
}

/**
 * The mark on an item's icon, as the Plastic desktop GUI overlays them: its pending status, else a link for an xlink,
 * private, or a check for an item under version control and up to date. A repository tree (a changeset browsed, not
 * the workspace) has only controlled items, so the check tells nothing there and is left out.
 */
export type IconOverlay = StatusTone | 'xlink' | 'controlled' | 'none';

export function iconOverlay(item: Pick<TreeItem, 'isPrivate' | 'xlink'>, status: ItemStatus | null, inWorkspace = true): IconOverlay {
  if (status) return status.tone;
  if (item.xlink) return 'xlink';
  if (item.isPrivate) return 'private';
  return inWorkspace ? 'controlled' : 'none';
}
