import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { toast } from '../../ui/toast/toastStore';
import type { ChangeRequestOpening } from '../../features/codeReviews/changeRequests/changeRequests';
import { conversationAt } from '../../features/codeReviews/inline/reviewComments';

/**
 * Opens a change request's review at its thread, brought into view and lit, as Show in conversation does: at once for one
 * the window read, after finding it by its guid for one it hasn't (a changeset's comment, from its details). A review of
 * a merge request opens as that merge request.
 */
export async function openChangeRequest(place: Place, opening: ChangeRequestOpening): Promise<void> {
  if (opening.kind === 'thread') {
    navigation.openPage(conversationAt(opening.reviewId, opening.threadId));
    return;
  }
  const { guid } = opening;
  try {
    const thread = await api.reviewComments.changeRequestThread(place, guid);
    if (thread) navigation.openPage(conversationAt(thread.reviewId, thread.threadId));
    else toast.info(`Change request ${guid} not found`, "It was deleted, or it's in a code review you can't see.");
  } catch (error) {
    toast.error(`Couldn't open change request ${guid}`, error);
  }
}
