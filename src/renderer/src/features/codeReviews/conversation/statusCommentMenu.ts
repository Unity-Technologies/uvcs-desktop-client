import type { ReviewEvent } from '@shared/domain/reviewConversation';
import type { MenuEntry } from '../../../lib/actions';
import { groupedMenu } from '../../../lib/menuGroups';
import { menuAction } from '../../../components/menuWords';
import { canEditStatusComment } from './commentPermissions';

/**
 * A status change's menu in the timeline: its reviewer edits what they said with it (`canEditStatusComment`). Empty
 * for anyone else, so the row shows no menu.
 */
export function statusCommentMenu(event: ReviewEvent, user: string | undefined, actions: { edit: () => void }): MenuEntry[] {
  return groupedMenu([canEditStatusComment(event, user) && menuAction('editComment', actions.edit)]);
}
