import type { ChangesetSpan, PageOf, ReviewTab } from '../../app/navigation/pages';
import type { DiffFocusRequest } from '../diff/diffFocusRequest';

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

/** The reply the conversation goes to in the thread it scrolls to (`conversationFocus`): the one a link names. */
export function conversationReplyFocus(page: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath' | 'focusThread' | 'focusReply'>): number | undefined {
  return conversationFocus(page) === undefined ? undefined : page.focusReply;
}

/**
 * The page once a thread is picked in the conversation's Open: it no longer names the thread (nor the reply) it was
 * opened at (`conversationFocus`), so Show in conversation at that thread again changes the page and goes to it
 * (`pickOnFocus`). Replaced in place, never stacked. The same page when it names none.
 */
export function pageAfterOpenPick(page: PageOf<'codeReview'>): PageOf<'codeReview'> {
  return conversationFocus(page) === undefined ? page : { ...page, focusThread: undefined, focusReply: undefined };
}

/** What a review's page asks its changes to go to: a thread, a changeset of its branch, a span of them, or a thread in a changeset. */
export interface ChangesFocus {
  threadId?: number;
  changesetId?: number;
  changesets?: ChangesetSpan;
}

type FocusFields = Pick<PageOf<'codeReview'>, 'tab' | 'focusPath' | 'focusThread' | 'focusChangeset' | 'focusChangesets'>;

/**
 * What the review's changes go to as its page moves (`movesWithinTop`: a comment's file gone to from the conversation,
 * a check-in, a change request shown where it was applied, what's new since the user's review): the changes, mounted
 * already, read their page's focus only as they mount. None for the same page, a tab picked, or a page going to the
 * conversation.
 */
export function changesFocusAskedFor(shown: FocusFields, next: FocusFields): ChangesFocus | undefined {
  if (next === shown || openingTab(next) !== 'changes') return undefined;
  const focus: ChangesFocus = {
    ...(next.focusThread !== undefined && { threadId: next.focusThread }),
    ...(next.focusChangeset !== undefined && { changesetId: next.focusChangeset }),
    ...(next.focusChangesets !== undefined && { changesets: next.focusChangesets }),
  };
  return Object.keys(focus).length > 0 ? focus : undefined;
}

/** What the review's diff is asked for to go to a changeset or a span with no thread: that mode, the file left as it is. */
export function changesFocusRequest({ changesetId, changesets }: Omit<ChangesFocus, 'threadId'>, seq: number): DiffFocusRequest {
  return { ...(changesetId !== undefined && { changesetId }), ...(changesets && { changesets }), seq };
}

/**
 * Whether a review's tab shows on its page (`openingTab`). The other stays mounted, hidden (`mountedTabs`): its keys
 * off meanwhile (`ViewShownContext`), so N in the conversation doesn't step through the Changes tab's comments.
 */
export function reviewTabShown(page: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath'>, tab: ReviewTab): boolean {
  return openingTab(page) === tab;
}
