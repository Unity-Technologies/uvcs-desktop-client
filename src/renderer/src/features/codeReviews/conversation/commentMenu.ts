import type { ReviewComment } from '@shared/domain/reviewConversation';
import type { MenuEntry } from '../../../lib/actions';
import { groupedMenu } from '../../../lib/menuGroups';
import { menuAction } from '../../../components/menuWords';
import { canDeleteComment, canEditComment } from './commentPermissions';
import type { ReviewThread } from './reviewThreads';

interface CommentMenuActions {
  edit: () => void;
  remove: () => void;
  copyText: () => void;
}

/** A comment's menu: its text to copy for anyone; edit and delete for its author, as `commentPermissions` allows. */
export function commentMenu(comment: ReviewComment, thread: ReviewThread, user: string | undefined, actions: CommentMenuActions): MenuEntry[] {
  return groupedMenu([
    canEditComment(comment, user) && menuAction('editComment', actions.edit),
    menuAction('copyText', actions.copyText),
    canDeleteComment(comment, thread, user) && menuAction('delete', actions.remove),
  ]);
}
