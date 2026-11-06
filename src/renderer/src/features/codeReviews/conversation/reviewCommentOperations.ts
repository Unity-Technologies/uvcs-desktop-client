import type { Place } from '@shared/domain/place';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { api } from '../../../api/client';
import { runVoidAction } from '../../../app/operations/runOperation';
import { isAffectedByCodeReviews } from '../../../app/refresh/refreshScopes';
import { confirm } from '../../../ui/dialog/confirm';

// Every write on a review reads the review again, its lists too: the counts of comments and open ones change with it.
// Each resolves to whether it was done, so the field that wrote it is cleared or keeps the text to try again.

export function addReviewComment(place: Place, reviewId: number, text: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't add the comment", () => api.reviewComments.add(place, reviewId, text), isAffectedByCodeReviews);
}

export function replyToComment(place: Place, comment: Pick<ReviewComment, 'guid'>, text: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't reply", () => api.reviewComments.reply(place, comment.guid, text), isAffectedByCodeReviews);
}

/** Discards a change request with a reply saying why: it's no longer open. */
export function discardChangeRequest(place: Place, changeRequest: Pick<ReviewComment, 'guid'>, why: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't discard the change request", () => api.reviewComments.reply(place, changeRequest.guid, why, { discard: true }), isAffectedByCodeReviews);
}

export function editReviewComment(place: Place, comment: Pick<ReviewComment, 'guid'>, text: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't save the comment", () => api.reviewComments.edit(place, comment.guid, text), isAffectedByCodeReviews);
}

export async function deleteReviewComment(place: Place, comment: Pick<ReviewComment, 'guid'>): Promise<boolean> {
  const confirmed = await confirm({ title: 'Delete this comment?', message: 'Everyone on the review stops seeing it.', confirmLabel: 'Delete', danger: true });
  if (!confirmed) return false;
  return runVoidAction(place, "Couldn't delete the comment", () => api.reviewComments.remove(place, comment.guid), isAffectedByCodeReviews);
}

export function saveReviewDescription(place: Place, reviewId: number, text: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't save the description", () => api.reviewComments.setDescription(place, reviewId, text), isAffectedByCodeReviews);
}
