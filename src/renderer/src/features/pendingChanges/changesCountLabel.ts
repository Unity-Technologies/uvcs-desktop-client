import { formatCount, pluralize } from '../../lib/text';

/**
 * The count above the list of changes: "5 files", "2 of 5" while the filter hides some, "0 files" with nothing
 * pending; null until the changes are read (`totalCount` undefined), when a placeholder stands for it.
 */
export function changesCountLabel(totalCount: number | undefined, shownCount: number): string | null {
  if (totalCount === undefined) return null;
  return shownCount === totalCount ? pluralize(totalCount, 'file') : `${formatCount(shownCount)} of ${formatCount(totalCount)}`;
}
