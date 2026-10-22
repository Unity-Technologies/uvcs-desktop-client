import type { ItemDetails, TreeItem } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import { xlinkKind, xlinkSummary } from '../../components/xlinkWords';

type ListedItem = Pick<TreeItem, 'itemType' | 'xlink'>;

/** The type an item's icon draws: `cm ls` lists an xlink as a directory, and Files treats it as one; it draws as an xlink. */
export function iconTypeOf(item: ListedItem): ItemType {
  return item.xlink ? 'xlink' : item.itemType;
}

/** What the details heading calls an item: its icon, and its noun ("Writable xlink", as a diff names one). */
export interface DetailsKind {
  icon: 'xlink' | 'directory' | 'symlink' | 'file';
  noun: string;
}

const NOUNS = { directory: 'Folder', symlink: 'Link', file: 'File' } as const;

export function detailsKindOf(item: ListedItem): DetailsKind {
  if (item.xlink) return { icon: 'xlink', noun: xlinkKind(item.xlink) };
  const icon = item.itemType === 'directory' || item.itemType === 'symlink' ? item.itemType : 'file';
  return { icon, noun: NOUNS[icon] };
}

/** The details' "Xlink" row: where it points, from the listing, else as `cm fileinfo` words it. */
export function xlinkDetailOf(item: Pick<TreeItem, 'xlink'>, details: Pick<ItemDetails, 'xlinkTarget'> | undefined): string | undefined {
  return item.xlink ? xlinkSummary(item.xlink) : details?.xlinkTarget;
}
