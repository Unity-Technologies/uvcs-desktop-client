import { serverOfRepository } from '@shared/domain/permissions';
import type { Place } from '@shared/domain/place';
import type { CodeReview, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { readServerUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { queryClient } from '../../app/queryClient';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { deleteReviewsQuestion } from './deleteReviewsQuestion';
import { isReviewer, reviewerNames } from './reviewers';

/**
 * Sets the user's own status on a review. Only reviewers give one, so a user who isn't one yet is asked to join
 * first: both happen at once.
 */
export async function setOwnReviewStatus(place: Place, review: CodeReviewSummary, status: CodeReviewStatus): Promise<void> {
  const user = await placeUser(place);
  const joining = !isReviewer(review, user);
  if (joining) {
    const confirmed = await confirm({
      title: `Mark as “${status}”`,
      message: "You aren't one of its reviewers yet. You'll be added as one.",
      confirmLabel: 'Add me and mark',
    });
    if (!confirmed || !user) return;
  }
  await runAction(
    place,
    "Couldn't change your review status",
    async () => {
      if (joining && user) await api.codeReviews.addReviewers(place, review.id, [user]);
      await api.codeReviews.setOwnStatus(place, review.id, status);
    },
    isAffectedByCodeReviews,
  );
}

/** Who the user is on the place's server, if already known or quick to read. */
async function placeUser(place: Place): Promise<string | undefined> {
  const server =
    place.kind === 'repository' ? serverOfRepository(place.repository) : queryClient.getQueryData<WorkspaceInfo>(queryKeys.inPlace(place, 'info'))?.server;
  return server ? readServerUser(server).catch(() => undefined) : undefined;
}

export async function addReviewers(place: Place, review: CodeReviewSummary): Promise<void> {
  const typed = await prompt({
    title: 'Add reviewers',
    label: 'Reviewers',
    description: 'The users who should review these changes, separated by commas.',
    confirmLabel: 'Add',
  });
  const users = typed === undefined ? [] : reviewerNames(typed);
  if (users.length === 0) return;
  await runAction(place, "Couldn't add the reviewers", () => api.codeReviews.addReviewers(place, review.id, users), isAffectedByCodeReviews);
}

/** Resolves to true when the reviews were deleted. */
export async function deleteReviews(place: Place, reviews: CodeReviewSummary[]): Promise<boolean> {
  const confirmed = await confirm({
    ...deleteReviewsQuestion(reviews.map((review) => review.title)),
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return false;

  return runVoidAction(
    place,
    "Couldn't delete the review",
    () => api.codeReviews.remove(place, reviews.map((review) => review.id)),
    isAffectedByCodeReviews,
  );
}

export function codeReviewPage(review: Pick<CodeReview, 'id'>, focusPath?: string): PageOf<'codeReview'> {
  return { kind: 'codeReview', reviewId: review.id, focusPath };
}

export function openReview(review: Pick<CodeReview, 'id'>, focusPath?: string): void {
  navigation.openPage(codeReviewPage(review, focusPath));
}
