import type { PageOf, ReviewTab } from '../../app/navigation/pages';

/** The tab a review page opens on: the one it names, else its changes when it names a file, else its conversation. */
export function openingTab(page: Pick<PageOf<'codeReview'>, 'tab' | 'focusPath'>): ReviewTab {
  return page.tab ?? (page.focusPath === undefined ? 'conversation' : 'changes');
}
