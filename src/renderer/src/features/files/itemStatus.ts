import type { TreeItem } from '@shared/domain/explorer';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { StatusMark } from '../../components/ItemStatusMark';
import { existsOnDisk } from '../pendingChanges/changeCategories';
import { changeStatus } from '../pendingChanges/changeTone';

export interface ItemStatus extends StatusMark {
  /** The file as it is on disk, for a file with a pending change: `cm ls` reports its loaded revision (0 bytes once added). */
  onDisk?: { size: number; date: string };
}

/** Indexes pending changes so the tree can look up each item's status quickly. */
export class PendingChangesIndex {
  private readonly byPath: Map<string, PendingChange>;
  /** How many changes each directory holds, at any depth. */
  private readonly changesInside = new Map<string, number>();

  constructor(changes: PendingChange[]) {
    this.byPath = new Map(changes.map((change) => [change.path, change]));
    for (const change of changes) {
      const segments = change.path.split('/');
      for (let length = 1; length < segments.length; length++) {
        const directory = segments.slice(0, length).join('/');
        this.changesInside.set(directory, (this.changesInside.get(directory) ?? 0) + 1);
      }
    }
  }

  changeAt(path: string): PendingChange | undefined {
    return this.byPath.get(path);
  }

  hasChangesInside(directory: string): boolean {
    return this.changesInside.has(directory);
  }

  /** The changes anywhere below a directory; the workspace root (`''`) holds them all. */
  countInside(directory: string): number {
    return directory === '' ? this.byPath.size : (this.changesInside.get(directory) ?? 0);
  }
}

/** The status shown for a tree item: its own pending change, else private / checked out. */
export function itemStatus(item: TreeItem, index: PendingChangesIndex): ItemStatus | null {
  const change = index.changeAt(item.path);
  if (change) {
    const status = changeStatus(change);
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
