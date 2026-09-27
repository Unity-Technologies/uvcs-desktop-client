import type { ItemType } from '@shared/domain/pendingChanges';

const LABELS: Record<ItemType, string> = {
  file: 'Text file',
  binaryFile: 'Binary file',
  directory: 'Folder',
  symlink: 'Symbolic link',
  xlink: 'Xlink',
};

/** What an item is, in the details' Type. */
export function itemTypeLabel(itemType: ItemType): string {
  return LABELS[itemType];
}

/** Only files are stored as text or binary. `cm changerevisiontype` on a symbolic link changes the file it points to. */
export function hasRevisionType(itemType: ItemType): boolean {
  return itemType === 'file' || itemType === 'binaryFile';
}
