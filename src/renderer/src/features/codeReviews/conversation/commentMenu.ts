import type { ReviewComment } from '@shared/domain/reviewConversation';
import type { MenuEntry } from '../../../lib/actions';
import { tidyMenu } from '../../../lib/actions';
import { canDeleteComment, canEditComment } from './commentPermissions';
import type { ReviewThread } from './reviewThreads';

interface CommentMenuActions {
  edit: () => void;
  remove: () => void;
  copyText: () => void;
}

/** A comment's menu: its text to copy for anyone; edit and delete for its author, as `commentPermissions` allows. */
export function commentMenu(comment: ReviewComment, thread: ReviewThread, user: string | undefined, actions: CommentMenuActions): MenuEntry[] {
  return tidyMenu([
    canEditComment(comment, user) && { id: 'edit', label: 'Edit', run: actions.edit },
    { id: 'copyText', label: 'Copy text', run: actions.copyText },
    canDeleteComment(comment, thread, user) && { id: 'delete', label: 'Delete…', danger: true, run: actions.remove },
  ]);
}
