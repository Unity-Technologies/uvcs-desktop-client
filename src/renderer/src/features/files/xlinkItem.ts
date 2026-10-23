import type { ItemDetails, TreeItem, XlinkTarget } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import { xlinkKind, xlinkSummary } from '../../components/xlinkWords';
import { parentOf } from '../../lib/paths';

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

/**
 * Where an item is as far as xlinks go: what Files' menu reads to offer creating or editing one.
 */
export interface XlinkSurroundings {
  /** A folder above it is an xlink (`isUnderXlink`): it lives in the xlinked repository. */
  underXlink: boolean;
  /** The workspace's repository, `name@server`, once read: an item of another one is under an xlink too. */
  workspaceRepository: string | undefined;
}

/**
 * Whether a folder above `path` is an xlink, as far as the tree's listings tell: the tree lists every folder it shows,
 * so every folder above an item the user can see. `listing` gives a folder's listed items (`''` is the root).
 */
export function isUnderXlink(path: string, listing: (directory: string) => readonly Pick<TreeItem, 'path' | 'xlink'>[] | undefined): boolean {
  for (let folder = parentOf(path); folder !== ''; folder = parentOf(folder)) {
    if (listing(parentOf(folder))?.find((item) => item.path === folder)?.xlink) return true;
  }
  return false;
}

/**
 * The folder a new xlink made from an item goes into: the item itself, or a file's folder. Only a controlled folder
 * of the workspace's own repository takes one (`cm`: "is not in a workspace"), so none from a private item, whose
 * folder may be private too, nor from an xlink or anything under one: the new one would go in the xlinked repository.
 */
export function newXlinkDirectoryOf(item: Pick<TreeItem, 'path' | 'itemType' | 'isPrivate' | 'xlink' | 'repository'>, where: XlinkSurroundings): string | null {
  if (item.isPrivate || item.xlink || where.underXlink) return null;
  if (where.workspaceRepository && item.repository && item.repository !== where.workspaceRepository) return null;
  return item.itemType === 'directory' ? item.path : parentOf(item.path);
}

/**
 * The item as an xlink to edit: a controlled one (a new one too, before it is checked in), and not one nested under
 * another xlink, which belongs to the xlinked repository.
 */
export function editableXlinkOf<Item extends Pick<TreeItem, 'xlink' | 'isPrivate'>>(item: Item, where: Pick<XlinkSurroundings, 'underXlink'>): (Item & { xlink: XlinkTarget }) | null {
  return item.xlink && !item.isPrivate && !where.underXlink ? (item as Item & { xlink: XlinkTarget }) : null;
}
