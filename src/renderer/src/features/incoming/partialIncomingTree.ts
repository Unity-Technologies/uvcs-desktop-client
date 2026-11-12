import type { PartialIncomingItem } from '@shared/domain/incoming';
import { ownTone } from '../../components/changeFilter';
import type { FileListViewOffer } from '../../components/fileListViewMenuModel';
import type { StatusMark } from '../../components/ItemStatusMark';
import type { StatusTone } from '../../components/StatusBadge';
import type { GroupedFileListFacts } from '../../components/statusGroups';
import type { GroupedTreeRow, TreeGroup } from '../../lib/groupedPathTree';
import { partialItemDetail, partialItemKey, type PartialItemGroup } from './partialIncomingItems';

const KIND_TONES: Record<PartialIncomingItem['kind'], StatusTone> = { changed: 'changed', moved: 'moved', removed: 'deleted', added: 'added' };

/** The statuses an item shows and the filter chips find it by: what the branch did to it, then a conflict. */
export function partialItemTones(item: PartialIncomingItem): readonly StatusTone[] {
  return item.conflict ? [KIND_TONES[item.kind], 'conflict'] : [KIND_TONES[item.kind]];
}

/** The letter at the end of an item's row: what the branch did to it, its line (`partialItemDetail`) as the tooltip. */
export function partialItemStatus(item: PartialIncomingItem): StatusMark {
  return { tone: KIND_TONES[item.kind], label: partialItemDetail(item) };
}

/** The groups of `partialItemGroups`, as the shared list of changed files lays them out (`useGroupedFileTree`). */
export function partialItemTreeGroups(groups: readonly PartialItemGroup[]): TreeGroup<PartialIncomingItem, string>[] {
  return groups.map((group) => ({ key: `group:${group.title}`, label: group.title, group: group.title, sorted: group.items }));
}

export const PARTIAL_ITEM_FACTS: GroupedFileListFacts<PartialIncomingItem, string> = { toneOf: (item) => ownTone(partialItemTones(item)) };

/** The groups are the view's own (conflicts first, then by kind): the view menu offers no grouping by status. */
export const PARTIAL_VIEW_OFFER: FileListViewOffer = { statusGroups: false };

/** The item a selected row stands for: an item's own row, or a folder's row that is an item (a moved folder). */
export function partialItemAt(
  items: readonly PartialIncomingItem[],
  rows: readonly GroupedTreeRow<PartialIncomingItem, string>[],
  key: string | null,
): PartialIncomingItem | undefined {
  if (key === null) return undefined;
  const item = items.find((candidate) => partialItemKey(candidate) === key);
  if (item) return item;
  const row = rows.find((candidate) => candidate.key === key);
  return row?.type === 'folder' ? row.item : undefined;
}
