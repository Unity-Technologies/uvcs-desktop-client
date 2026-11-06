import { serverOfRepository } from '@shared/domain/permissions';
import type { Place } from '@shared/domain/place';
import type { CodeReview, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { cachedServerUser, readServerUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { queryClient } from '../../app/queryClient';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { deleteReviewsQuestion } from './deleteReviewsQuestion';
import { changesOwnStatus, isReviewer, reviewerNames } from './reviewers';

/**
 * Sets the user's own status on a review, unless it's the one they gave already. Only reviewers give one, so a user
 * known not to be one yet is asked to join first: both happen at once. A user not known (their account still being
 * read) sets it as they are: the server takes it from a reviewer or a member of a reviewer group, and says why not to
 * anyone else.
 */
export async function setOwnReviewStatus(place: Place, review: CodeReviewSummary, status: CodeReviewStatus, knownUser?: string): Promise<void> {
  const user = knownUser ?? (await placeUser(place));
  if (!changesOwnStatus(review, user, status)) return;
  const joining = user !== undefined && !isReviewer(review, user) ? user : undefined;
  if (joining) {
    const confirmed = await confirm({
      title: `Mark as “${status}”`,
      message: "You aren't one of its reviewers yet. You'll be added as one.",
      confirmLabel: 'Add me and mark',
    });
    if (!confirmed) return;
  }
  await runAction(
    place,
    "Couldn't change your review status",
    async () => {
      if (joining) await api.codeReviews.addReviewers(place, review.id, [joining]);
      await api.codeReviews.setOwnStatus(place, review.id, status);
    },
    isAffectedByCodeReviews,
  );
}

/** Who the user is on the place's server, if already known or quick to read. */
async function placeUser(place: Place): Promise<string | undefined> {
  const server = placeServer(place);
  return server ? readServerUser(server).catch(() => undefined) : undefined;
}

/** Who the user is on the place's server, if the window read it already: for menus, which are built at once. */
export function cachedPlaceUser(place: Place): string | undefined {
  const server = placeServer(place);
  return server ? cachedServerUser(server) : undefined;
}

function placeServer(place: Place): string | undefined {
  return place.kind === 'repository' ? serverOfRepository(place.repository) : queryClient.getQueryData<WorkspaceInfo>(queryKeys.inPlace(place, 'info'))?.server;
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

/** Gives the review a new title; resolves to whether it did. */
export function renameReview(place: Place, reviewId: number, title: string): Promise<boolean> {
  return runVoidAction(place, "Couldn't rename the review", () => api.codeReviews.rename(place, reviewId, title), isAffectedByCodeReviews);
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
