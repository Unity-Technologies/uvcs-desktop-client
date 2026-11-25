import { firstWaiting, inListOrder, type MergeItem, type MergeProgress } from './mergeItems';

/**
 * The item the merge page selects when it opens: the first item that needs the user, in the order the list shows them
 * (`items` as listed: a `.meta` joined to its asset is never one), else the first row. Undefined once the user (or the
 * page) selected something (`selectedKey`), which it never overrides.
 */
export function startingItem(selectedKey: string | null, items: MergeItem[], progress: MergeProgress): MergeItem | undefined {
  if (selectedKey !== null) return undefined;
  return firstWaiting(items, progress) ?? inListOrder(items)[0];
}
