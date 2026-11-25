import type { MergeItem } from './mergeItems';

/**
 * What the merge page's detail pane shows: nothing while the filters hide every item, the item selected, a spinner while
 * the page finds where to start (`startingItem`), a group or folder row's summary, or that nothing is selected.
 */
export type MergeDetailKind = 'hidden' | 'item' | 'loading' | 'group' | 'nothing';

export function mergeDetailOf({ hidesAll, shown, start, selectedGroup }: { hidesAll: boolean; shown: boolean; start: MergeItem | 'loading' | undefined; selectedGroup: boolean }): MergeDetailKind {
  if (hidesAll) return 'hidden';
  if (shown) return 'item';
  if (start === 'loading') return 'loading';
  return selectedGroup ? 'group' : 'nothing';
}
