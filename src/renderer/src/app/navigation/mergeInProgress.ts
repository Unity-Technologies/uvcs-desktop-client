import type { Page, PageOf } from './pages';

/**
 * The merge a workspace window is working on, from the moment its page opens until it completes or the user closes it.
 * Its page stays mounted while it lasts, on screen or not (`PlaceLayout`), so its decisions, its edits and the versions
 * it read survive going to another view, going back, or a page opened on top of it (a file's history). Only one at a
 * time: starting another one asks first (`navigation.openPage`). It belongs to its workspace: leaving the workspace
 * (home, another workspace) ends it, as the workspace's screen closes.
 */
export interface MergeInProgress {
  /** Tells one merge's page from the next one's, even for the same request: a new merge starts from nothing. */
  id: number;
  page: PageOf<'merge'>;
  /** The workspace it merges into, or from which it merges into a server branch. */
  workspacePath: string | null;
  /**
   * Nothing is left to keep: the merge completed, or there is nothing it can do (nothing to merge, pending changes in
   * the way). It stays until the user leaves it, so one that settled while set aside still shows how it ended.
   */
  settled: boolean;
}

/** The merge while it still holds the user's work: what Close and starting another merge ask about. */
export function mergeAwaiting(merge: MergeInProgress | null): MergeInProgress | null {
  return merge?.settled ? null : merge;
}

/** What is left of the merge once the user leaves its page without closing it: set aside, unless settled. */
export function mergeAfterLeaving(merge: MergeInProgress | null, pages: readonly Page[]): MergeInProgress | null {
  return showsMerge(merge, pages) ? mergeAwaiting(merge) : merge;
}

/**
 * Whether `page` merges what the merge in progress merges: opening it again goes back to that one. By what is merged
 * where, never by the rest a page carries (a task's review, its finishing choices).
 */
export function isSameMerge(merge: MergeInProgress, page: PageOf<'merge'>): boolean {
  const [a, b] = [merge.page.request, page.request];
  return (
    a.kind === b.kind &&
    a.sourceSpec === b.sourceSpec &&
    a.intervalOriginSpec === b.intervalOriginSpec &&
    a.destinationBranch === b.destinationBranch &&
    Boolean(a.deleteShelve) === Boolean(b.deleteShelve) &&
    merge.page.task?.branch.name === page.task?.branch.name
  );
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
