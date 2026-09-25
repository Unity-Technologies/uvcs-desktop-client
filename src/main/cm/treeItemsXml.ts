import type { TreeItem } from '@shared/domain/explorer';
import type { ItemType } from '@shared/domain/pendingChanges';
import { child, children, integer, parseXml, text } from './parseXml';

const ITEM_TYPES: Record<string, ItemType> = {
  dir: 'directory',
  txt: 'file',
  bin: 'binaryFile',
  sym: 'symlink',
  xlink: 'xlink',
};

/**
 * Parses `cm ls --xml`. The listed directory itself comes back as a `.` entry, which is skipped.
 * Paths are made relative with forward slashes: `--tree` listings return server paths (`/src/a.ts`).
 */
export function parseTreeItems(xml: string): TreeItem[] {
  const items = children(child(child(parseXml(xml, ['LsItem']), 'LsResults'), 'LsItems'), 'LsItem');

  return items
    .filter((item) => text(item.Name) !== '.')
    .map((item) => ({
      path: text(item.WkPath).replace(/\\/g, '/').replace(/^\//, ''),
      name: text(item.Name),
      itemType: ITEM_TYPES[text(item.Type)] ?? 'file',
      size: integer(item.Size, 0),
      date: meaningfulDate(text(item.Date)),
      isPrivate: text(item.Status) === 'Private',
      isCheckedOut: text(item.Checkout) !== '',
      changeset: integer(item.Changeset),
      branch: text(item.Branch),
      owner: text(item.Owner),
      revisionId: integer(item.RevId),
      parentRevisionId: integer(item.ParentRevId),
      itemId: integer(item.ItemId),
    }));
}

/** Items that are added but not checked in yet report the minimum date (`0001-01-01…`). */
function meaningfulDate(date: string): string {
  return date.startsWith('0001-') ? '' : date;
}
