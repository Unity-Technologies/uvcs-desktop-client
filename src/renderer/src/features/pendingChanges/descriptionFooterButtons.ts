import type { RecentCommentsOffer } from '@shared/domain/recentComments';
import { recentCommentLabel } from '../../lib/comment';

/** A button of the check-in description's footer: Recent comments, or the change requests to apply with their count. */
export type DescriptionFooterButton = { kind: 'recentComments'; tip: string } | { kind: 'changeRequests'; tip: string; count: number; label: string };

/**
 * The check-in description's footer (docs/features/changes.md "The check-in's comment"), quiet icons as GitHub Desktop
 * draws its own: Recent comments while there are some, then the change requests to apply while some are offered (the
 * open ones the comment doesn't name yet, `notYetNamed`), with their count. None at all: no footer, and the description
 * is as it always was.
 */
export function descriptionFooterButtons({ recentComments, changeRequests }: { recentComments: boolean; changeRequests: number }): DescriptionFooterButton[] {
  return [
    ...(recentComments ? [{ kind: 'recentComments' as const, tip: 'Recent comments' }] : []),
    ...(changeRequests > 0
      ? [{ kind: 'changeRequests' as const, tip: 'Change requests to apply', count: changeRequests, label: `${changeRequests} change ${changeRequests === 1 ? 'request' : 'requests'} to apply` }]
      : []),
  ];
}

/** An item of the Recent comments menu: a comment to pick, or what the menu waits for, disabled. */
export interface RecentCommentsMenuItem {
  label: string;
  comment?: string;
  disabled: boolean;
}

/** The Recent comments menu's items (`RecentCommentsOffer`): each comment by its first line, or what it waits for. */
export function recentCommentsMenuItems({ comments, waiting }: RecentCommentsOffer): RecentCommentsMenuItem[] {
  if (waiting !== null) return [{ label: waiting, disabled: true }];
  return comments.map((comment) => ({ label: recentCommentLabel(comment), comment, disabled: false }));
}

/**
 * How much taller the description is while its footer shows: the footer's row (`.descriptionFooter`, which the
 * description's bottom padding keeps clear), so it takes none of the room to type.
 */
export const DESCRIPTION_FOOTER_HEIGHT = 20;

/** The description's height, the one its resize handle sets, with its footer's row when it shows one. */
export function descriptionHeightWith(height: number, buttons: readonly DescriptionFooterButton[]): number {
  return buttons.length > 0 ? height + DESCRIPTION_FOOTER_HEIGHT : height;
}
