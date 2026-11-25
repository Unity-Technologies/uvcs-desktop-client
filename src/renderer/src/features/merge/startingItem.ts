import { fileStateOf, inListOrder, needsDecision, type MergeItem, type MergeProgress } from './mergeItems';

/**
 * The item the merge page selects when it opens: the first item that needs the user, in the order the list shows them
 * (`items` as listed: a `.meta` joined to its asset is never one), else the first row. A file conflict whose versions
 * are still loading may merge by itself, so while one comes before any item known to need the user, it can't tell yet:
 * undefined, and the page waits rather than open on a file it would then leave. Undefined too once something is
 * selected (`selectedKey`), by the user or by the page: it never moves a selection made.
 */
export function startingItem(selectedKey: string | null, items: MergeItem[], progress: MergeProgress): MergeItem | undefined {
  if (selectedKey !== null) return undefined;
  const listed = inListOrder(items);
  for (const item of listed) {
    if (item.kind === 'fileConflict' && fileStateOf(item, progress).status === 'loading') return undefined;
    if (needsDecision(item, progress)) return item;
  }
  return listed[0];
}
