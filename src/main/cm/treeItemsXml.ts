import type { TreeItem } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import { child, children, dateText, integer, parseXml, text } from './parseXml';
import { parseXlinkName } from './xlinkName';

const ITEM_TYPES: Record<string, ItemType> = {
  dir: 'directory',
  txt: 'file',
  bin: 'binaryFile',
  link: 'symlink',
  xlink: 'xlink',
};

/** A listed item, with what only the main process uses. */
export interface ListedTreeItem extends TreeItem {
  /**
   * MD5 of its revision's content, base64, as `cm` keeps it: in a workspace, the revision it was loaded from, even
   * once the file on disk changed (a checkout, revision -1, lists the disk's). Unset for a private item. It tells the
   * disk's copy of the revision (`WorkspaceCopies`) and stays in the main process (`withoutHash`).
   */
  hash?: string;
}

/** The item as the windows get it. */
export function withoutHash({ hash: _hash, ...item }: ListedTreeItem): TreeItem {
  return item;
}

/**
 * Parses `cm ls --xml`. The listed directory itself comes back as a `.` entry, which is skipped.
 * Paths are made relative with forward slashes: `--tree` listings return server paths (`/src/a.ts`).
 * Names come from the path: an xlink's `<Name>` is its target (`lib -> xlink -> / 12@lib@server`), read into `xlink`.
 * `<Repository>` (`rep:editorGUI@acme@cloud`) is the one holding the item's revision: under an xlink, the xlinked one.
 * Workspace listings take `--symlink` (`onLinksThemselves`): without it a link to a folder reads as that folder,
 * children and paths included.
 */
export function parseTreeItems(xml: string): ListedTreeItem[] {
  const items = children(child(child(parseXml(xml, ['LsItem']), 'LsResults'), 'LsItems'), 'LsItem');

  return items.filter((item) => text(item.Name) !== '.').map(treeItem);
}

function treeItem(item: Record<string, unknown>): ListedTreeItem {
  const path = text(item.WkPath).replace(/\\/g, '/').replace(/^\//, '');
  const listedName = text(item.Name);
  const xlink = parseXlinkName(listedName);
  const symlinkTarget = text(item.SymlinkTarget).replace(/^\s*->\s*/, '');
  const changeset = integer(item.Changeset);
  const revisionId = integer(item.RevId);
  // A revision numbered below zero is a shelve's (`-id`, on branch `id:-1`); a private item has neither.
  const shelveId = changeset < 0 && revisionId > 0 ? -changeset : undefined;
  const hash = text(item.Hash);
  return {
    path,
    name: path ? path.slice(path.lastIndexOf('/') + 1) : listedName,
    itemType: ITEM_TYPES[text(item.Type)] ?? 'file',
    size: integer(item.Size, 0),
    date: dateText(item.Date),
    isPrivate: text(item.Status) === 'Private',
    isCheckedOut: text(item.Checkout) !== '',
    changeset: shelveId === undefined ? changeset : null,
    branch: shelveId === undefined ? text(item.Branch) : '',
    owner: text(item.Owner),
    revisionId,
    parentRevisionId: integer(item.ParentRevId),
    repository: text(item.Repository).replace(/^rep:/, ''),
    itemId: integer(item.ItemId),
    ...(hash && { hash }),
    ...(shelveId !== undefined && { shelveId }),
    ...(xlink && { xlink }),
    ...(symlinkTarget && { symlinkTarget }),
  };
}
