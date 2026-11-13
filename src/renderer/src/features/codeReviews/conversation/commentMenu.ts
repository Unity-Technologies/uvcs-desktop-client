import type { ReviewComment } from '@shared/domain/reviewConversation';
import type { MenuEntry } from '../../../lib/actions';
import { groupedMenu } from '../../../lib/menuGroups';
import { menuAction, type MenuWordId } from '../../../components/menuWords';
import { changeRequestMarkOf, type ChangeRequestMark } from './changeRequestMarks';
import { canDeleteComment, canEditComment } from './commentPermissions';
import type { ReviewThread } from './reviewThreads';

interface CommentMenuActions {
  edit: () => void;
  remove: () => void;
  copyText: () => void;
  /** Where the thread is in the conversation, from its code (the Changes tab). */
  showInConversation?: () => void;
  /** Marks its change request applied (in a changeset picked) or not applied, where the review is known. */
  markChangeRequest?: (mark: ChangeRequestMark) => void;
}

const MARK_WORDS = { applied: 'markApplied', notApplied: 'markNotApplied' } as const satisfies Record<ChangeRequestMark, MenuWordId>;

/**
 * A comment's menu: its text to copy for anyone; edit and delete for its author, as `commentPermissions` allows. A
 * thread's first comment, shown in the code, leads to the thread in the conversation; a change request's is marked
 * applied or not applied by hand, as `changeRequestMarkOf` allows with this `cm` (`cmVersion`).
 */
export function commentMenu(comment: ReviewComment, thread: ReviewThread, user: string | undefined, actions: CommentMenuActions, cmVersion?: string): MenuEntry[] {
  const isRoot = comment.id === thread.root.id;
  const { markChangeRequest } = actions;
  const mark = markChangeRequest && changeRequestMarkOf(comment, thread, user, cmVersion);
  return groupedMenu([
    mark && menuAction(MARK_WORDS[mark], () => markChangeRequest?.(mark)),
    isRoot && actions.showInConversation && menuAction('showInConversation', actions.showInConversation),
    canEditComment(comment, user) && menuAction('editComment', actions.edit),
    menuAction('copyText', actions.copyText),
    canDeleteComment(comment, thread, user) && menuAction('delete', actions.remove),
  ]);
}
