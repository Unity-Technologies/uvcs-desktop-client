import type { SelectionState } from '../../lib/selection';

/**
 * The row the selection moves to once the rows are laid out again (List ↔ Tree), so it stays on the item it was made
 * on: a folder conflict is a row of its own in a list and its folder's row in a tree (`rowKeyOf`). Null leaves the
 * selection as it is: nothing selected, several rows (they say what they hold, not one item), the item filtered out
 * (`isListed`), or the selection already on the row showing it.
 */
export function rowKeyAfterLayout(
  itemKey: string | undefined,
  selection: SelectionState,
  isListed: (itemKey: string) => boolean,
  rowKeyOf: (itemKey: string) => string,
): string | null {
  if (itemKey === undefined || selection.selected.size !== 1 || !isListed(itemKey)) return null;
  const rowKey = rowKeyOf(itemKey);
  return selection.selected.has(rowKey) ? null : rowKey;
}
