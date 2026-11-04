import { formatCount, pluralize } from '../../lib/text';

/**
 * The count above the list of changes: "5 files", "2 of 5" while the filter hides some, "0 files" with nothing pending;
 * null until the changes are read (`totalCount` undefined), when a placeholder stands for it. The counts are of rows;
 * `metaCount`, the Unity `.meta` files sharing their asset's row (`pairPendingMetas`), is added apart ("6 files + 2
 * meta", as their rows are tagged "+ meta"), so a list of pending changes adds up to the changes pending the header
 * counts (ignored, cloaked or hidden items shown by the list's options aren't pending, and the header leaves them out).
 */
export function changesCountLabel(totalCount: number | undefined, shownCount: number, metaCount = 0): string | null {
  if (totalCount === undefined) return null;
  if (shownCount !== totalCount) return `${formatCount(shownCount)} of ${formatCount(totalCount)}`;
  const files = pluralize(totalCount, 'file');
  return metaCount > 0 ? `${files} + ${formatCount(metaCount)} meta` : files;
}
