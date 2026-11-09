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
  /** Where the thread is in the conversation, from its code (the Changes tab). */
  showInConversation?: () => void;
  /** The file compared from the version the thread was written on, for one written on an earlier version. */
  changesSince?: () => void;
}

/**
 * A comment's menu: its text to copy for anyone; edit and delete for its author, as `commentPermissions` allows. A
 * thread's first comment, shown in the code, leads to the thread in the conversation and to what changed since it.
 */
export function commentMenu(comment: ReviewComment, thread: ReviewThread, user: string | undefined, actions: CommentMenuActions): MenuEntry[] {
  const isRoot = comment.id === thread.root.id;
  return groupedMenu([
    isRoot && actions.showInConversation && menuAction('showInConversation', actions.showInConversation),
    isRoot && actions.changesSince && menuAction('changesSinceComment', actions.changesSince),
    canEditComment(comment, user) && menuAction('editComment', actions.edit),
    menuAction('copyText', actions.copyText),
    canDeleteComment(comment, thread, user) && menuAction('delete', actions.remove),
  ]);
}
