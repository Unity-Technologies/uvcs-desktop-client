import { CODE_REVIEW_STATUSES, type CodeReviewSummary } from '@shared/domain/codeReview';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { copySubmenu, type CopyTexts } from '../../components/copyMenu';
import { menuAction, menuSubmenu } from '../../components/menuWords';
import { deleteReviews, openReview, reassignReview, setReviewStatus } from './codeReviewOperations';
import { reviewedCodeAction } from './reviewedCode';

/** What a code review is copied as, first what ⌘C copies: its number, then its title. */
export function codeReviewCopyTexts(review: Pick<CodeReviewSummary, 'id' | 'title'>): CopyTexts {
  return { number: String(review.id), title: review.title.trim() };
}

/**
 * The menu of the selected code reviews, the same wherever reviews show: the Code reviews view, the Branch Explorer,
 * the palette and their details. It brings the reviewed code to the workspace (`reviewedCodeAction`) wherever the
 * review comes with its target named, disabled where `workspaceOn` (what the workspace is on) already is: everywhere
 * but a branch review in the palette, whose searches don't read branch names (ARCHITECTURE.md "Menus").
 */
export function codeReviewMenu(workspacePath: string, reviews: CodeReviewSummary[], workspaceOn?: WorkspaceSelector): MenuEntry[] {
  if (reviews.length === 0) return [];
  const single = reviews.length === 1 ? reviews[0]! : null;
  const reviewedCode = single?.target && reviewedCodeAction(workspacePath, single.target, workspaceOn);

  return groupedMenu([
    single && menuAction('openReview', () => openReview(single)),
    reviewedCode &&
      menuAction(reviewedCode.word, () => void reviewedCode.run(), {
        label: reviewedCode.label,
        // What makes no sense where the workspace already is stays in its place, disabled, as in the branch menu.
        ...(reviewedCode.disabledReason && { disabled: true, disabledReason: reviewedCode.disabledReason }),
      }),
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
