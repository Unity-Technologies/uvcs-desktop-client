import type { TreeItem } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import { integerValue, layoutFormat, readRecords, type RecordLayout } from './formatRecords';
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

/**
 * The revision `cm ls` printed for an item: none (`undefined`) for a private item or one not loaded, which print
 * `{revid}` empty; -1 for a checkout, whose revision isn't loaded; else its id. Every `cm ls` reader decides by it
 * (`parseTreeItems`, `parseWorkspaceListing`).
 */
export function listedRevisionId(revid: string): number | undefined {
  return revid === '' ? undefined : integerValue(revid);
}

/** The item as the windows get it. */
export function withoutHash({ hash: _hash, ...item }: ListedTreeItem): TreeItem {
  return item;
}

/**
 * A record of `cm ls --format`, the listed directory itself as a `.` entry. `{date:o}` asks the round-trip format of
 * any date `cm ls` prints (`--xml` prints the client config's, if it sets one). `--format` has no `{status}`: a
 * private item is the one with no revision but a size (an item not loaded has neither), and unlike `--xml`, which
 * reads the GUIDs of everything it lists, it asks the server only for the branches.
 */
const TREE_ITEM_FIELDS = ['name', 'wkpath', 'type', 'size', 'date:o', 'checkout', 'changeset', 'branch', 'owner', 'revid', 'parentrevid', 'repspec', 'itemid', 'hash', 'symlinktarget'] as const;

type TreeItemField = (typeof TREE_ITEM_FIELDS)[number];

export const TREE_ITEMS: RecordLayout<ListedTreeItem, TreeItemField> = {
  fields: TREE_ITEM_FIELDS,
  read: (value) => (value('name') === '.' ? undefined : treeItem(value)),
};

/** The `--format` of every `cm ls` read with `parseTreeItems`. */
export const TREE_ITEM_FORMAT = layoutFormat(TREE_ITEMS);

/**
 * Parses `cm ls --format=TREE_ITEM_FORMAT`. The listed directory itself is skipped.
 * Paths are made relative with forward slashes: `--tree` listings return server paths (`/src/a.ts`).
 * Names come from the path: an xlink's `{name}` is its target (`lib -> xlink -> / 12@lib@server`), read into `xlink`.
 * `{repspec}` (`rep:editorGUI@acme@cloud`) is the repository holding the item's revision: under an xlink, the xlinked
 * one. Workspace listings take `--symlink` (`onLinksThemselves`): without it a link to a folder reads as that folder,
 * children and paths included.
 */
export function parseTreeItems(output: string): ListedTreeItem[] {
  return readRecords(TREE_ITEMS, output);
}

function treeItem(value: (field: TreeItemField) => string): ListedTreeItem {
  const path = value('wkpath').replace(/\\/g, '/').replace(/^\//, '');
  const listedName = value('name');
  const xlink = parseXlinkName(listedName);
  const symlinkTarget = value('symlinktarget').replace(/^\s*->\s*/, '');
  const changeset = integerValue(value('changeset'));
  const listedRevision = listedRevisionId(value('revid'));
  const revisionId = listedRevision ?? -1;
  // A revision numbered below zero is a shelve's (`-id`, on branch `id:-1`); a private item has neither.
  const shelveId = changeset < 0 && revisionId > 0 ? -changeset : undefined;
  const hash = value('hash');
  const date = value('date:o');
  return {
    path,
    name: path ? path.slice(path.lastIndexOf('/') + 1) : listedName,
    itemType: ITEM_TYPES[value('type')] ?? 'file',
    size: Number.parseInt(value('size'), 10) || 0,
    // `cm` prints the minimum date (`0001-01-01…`) for an item not checked in yet or not loaded.
    date: date.startsWith('0001-') ? '' : date,
    isPrivate: listedRevision === undefined && value('size') !== '',
    isCheckedOut: value('checkout') !== '',
    changeset: shelveId === undefined ? changeset : null,
    branch: shelveId === undefined ? value('branch') : '',
    owner: value('owner'),
    revisionId,
    parentRevisionId: integerValue(value('parentrevid')),
    repository: value('repspec').replace(/^rep:/, ''),
    itemId: integerValue(value('itemid')),
    ...(hash && { hash }),
    ...(shelveId !== undefined && { shelveId }),
    ...(xlink && { xlink }),
    ...(symlinkTarget && { symlinkTarget }),
  };
}
