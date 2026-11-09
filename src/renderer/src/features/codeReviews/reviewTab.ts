import type { PageOf, ReviewTab } from '../../app/navigation/pages';

/** The tab a review page opens on: the one it names, else its changes when it names a file, else its conversation. */
export function openingTab(page: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath'>): ReviewTab {
  return page.tab ?? (page.focusPath === undefined ? 'conversation' : 'changes');
}

/**
 * The tabs a review page keeps mounted: every one shown so far, the one shown now added. Going back to a tab finds it
 * as it was left (its scroll, the threads unfolded, a reply being written, the Comments panel's filter), as a view is
 * kept under the pages over it; a tab never shown isn't mounted, so its changes aren't read until asked for.
 */
export function mountedTabs(mounted: readonly ReviewTab[], shown: ReviewTab): readonly ReviewTab[] {
  return mounted.includes(shown) ? mounted : [...mounted, shown];
}
