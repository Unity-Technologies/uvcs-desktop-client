import type { Page, PageOf } from './pages';

/**
 * The merge a workspace window is working on, from the moment its page opens until it completes or the user closes it.
 * Its page stays mounted while it lasts, on screen or not (`PlaceLayout`), so its decisions, its edits and the versions
 * it read survive going to another view, going back, or a page opened on top of it (a file's history). Only one at a
 * time: starting another one asks first (`navigation.openPage`).
 */
export interface MergeInProgress {
  /** Tells one merge's page from the next one's, even for the same request: a new merge starts from nothing. */
  id: number;
  page: PageOf<'merge'>;
  /**
   * Nothing is left to keep: the merge completed, or there is nothing it can do (nothing to merge, pending changes in
   * the way). Leaving it closes it, as any other page.
   */
  settled: boolean;
}

/** The merge in progress while it still holds the user's work: the sidebar's way back to it and its Close. */
export function mergeAwaiting(merge: MergeInProgress | null): MergeInProgress | null {
  return merge?.settled ? null : merge;
}

/** Whether `page` merges what the merge in progress merges: opening it again goes back to that one. */
export function isSameMerge(merge: MergeInProgress, page: PageOf<'merge'>): boolean {
  return JSON.stringify([merge.page.request, merge.page.task]) === JSON.stringify([page.request, page.task]);
}

/** Whether the merge's page is the one on screen: the top page. */
export function showsMerge(merge: MergeInProgress | null, pages: readonly Page[]): boolean {
  return merge !== null && pages.at(-1) === merge.page;
}

/** The pages left once the merge's page closes: those under it. Pages opened on top of it were about it. */
export function pagesWithoutMerge(merge: MergeInProgress | null, pages: readonly Page[]): Page[] {
  const at = merge ? pages.indexOf(merge.page) : -1;
  return at === -1 ? [...pages] : pages.slice(0, at);
}

/** What is left of the merge once the user leaves its page without closing it: set aside, unless settled. */
export function mergeAfterLeaving(merge: MergeInProgress | null): MergeInProgress | null {
  return mergeAwaiting(merge);
}
