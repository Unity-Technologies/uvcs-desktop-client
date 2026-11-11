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

/**
 * The thread the conversation scrolls to: the page's, when it goes to it there ("Show in conversation"). One the page
 * goes to in its changes (a comment's file, from the conversation) isn't the conversation's: kept mounted behind, it
 * stays where it was left.
 */
export function conversationFocus(page: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath' | 'focusThread'>): number | undefined {
  return openingTab(page) === 'conversation' ? page.focusThread : undefined;
}

/**
 * The page once a thread is picked in the conversation's Open: it no longer names the thread it was opened at
 * (`conversationFocus`), so Show in conversation at that thread again changes the page and goes to it (`pickOnFocus`).
 * Replaced in place, never stacked. The same page when it names none.
 */
export function pageAfterOpenPick(page: PageOf<'codeReview'>): PageOf<'codeReview'> {
  return conversationFocus(page) === undefined ? page : { ...page, focusThread: undefined };
}

/**
 * The thread the review's changes go to as its page moves (`movesWithinTop`: a comment's file gone to from the
 * conversation): the changes, mounted already, read their page's thread only as they mount. None for the same page, a
 * tab picked, or a thread the conversation goes to.
 */
export function changesFocusAskedFor(
  shown: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath' | 'focusThread'>,
  next: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath' | 'focusThread'>,
): number | undefined {
  return next !== shown && openingTab(next) === 'changes' ? next.focusThread : undefined;
}

/**
 * Whether a review's tab shows on its page (`openingTab`). The other stays mounted, hidden (`mountedTabs`): its keys
 * off meanwhile (`ViewShownContext`), so N in the conversation doesn't step through the Changes tab's comments.
 */
export function reviewTabShown(page: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath'>, tab: ReviewTab): boolean {
  return openingTab(page) === tab;
}
