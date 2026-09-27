import { CODE_REVIEW_STATUSES, type CodeReviewSummary } from '@shared/domain/codeReview';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { deleteReviews, openReview, reassignReview, setReviewStatus } from './codeReviewOperations';

/** What a code review is copied as, first what ⌘C copies: its number, then its title. */
export function codeReviewCopyTexts(review: Pick<CodeReviewSummary, 'id' | 'title'>): CopyTexts {
  return { number: String(review.id), title: review.title.trim() };
}

/** The menu of the selected code reviews, the same wherever reviews show: the Code reviews view, the Branch Explorer, the palette and their details. */
export function codeReviewMenu(workspacePath: string, reviews: CodeReviewSummary[]): MenuEntry[] {
  if (reviews.length === 0) return [];
  const single = reviews.length === 1 ? reviews[0]! : null;

  return groupedMenu([
    single && menuAction('openReview', () => openReview(single)),
    single &&
      menuSubmenu(
        'status',
        CODE_REVIEW_STATUSES.map((status) => ({
          id: `status.${status}`,
          label: status,
          disabled: status === single.status,
          run: () => void setReviewStatus(workspacePath, single, status),
        })),
      ),
    single && menuAction('assign', () => void reassignReview(workspacePath, single)),
    single && copySubmenu('Code review', codeReviewCopyTexts(single), { shortcut: hotkey('listCopy') }),
    menuAction('delete', () => void deleteReviews(workspacePath, reviews), single ? {} : { label: `Delete ${reviews.length} reviews…` }),
  ]);
}
