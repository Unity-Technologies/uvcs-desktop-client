import { serverOfRepository } from '@shared/domain/permissions';
import type { Place } from '@shared/domain/place';
import type { CodeReview, CodeReviewStatus, CodeReviewSummary, ReviewSubscription } from '@shared/domain/codeReview';
import type { MemberRef } from '@shared/domain/member';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { cachedServerUser, readServerUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageOf } from '../../app/navigation/pages';
import { queryClient } from '../../app/queryClient';
import { runAction, runVoidAction } from '../../app/operations/runOperation';
import { isAffectedByCodeReviews, isAffectedByReviewSubscription, isAffectedByTakingPartInReview } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { reviewSubscriptionKey } from './codeReviewKey';
import { deleteReviewsQuestion } from './deleteReviewsQuestion';
import { pickReviewers } from './ReviewersDialog';
import type { ReviewerChanges } from './reviewerPick';
import { changesOwnStatus, isReviewer } from './reviewers';
import { subscriptionAfter } from './reviewSubscription';

/** How the user's own status is set: who they are when already known, what they say, whether they agreed to join. */
export interface OwnStatusOptions {
  /** Who the user is, when the caller knows already; otherwise read from the place's server. */
  user?: string;
  /** What they say about it, sent with the status. */
  comment?: string;
  /** The user was told already that they'll be added as a reviewer (the page's popover says so): no question asked. */
  joiningAgreed?: boolean;
}

/**
 * Sets the user's own status on a review, with what they say about it, unless it's the one they gave already and they
 * say nothing; resolves to whether it's set (false when the server refused it or the user said no), so what they
 * wrote is kept to try again. Only reviewers give one, so a user known not to be one yet is asked to join first (unless they agreed
 * already): both happen at once. A user not known (their account still being read) sets it as they are: the server
 * takes it from a reviewer or a member of a reviewer group, and says why not to anyone else.
 */
export async function setOwnReviewStatus(place: Place, review: CodeReviewSummary, status: CodeReviewStatus, options: OwnStatusOptions = {}): Promise<boolean> {
  const user = options.user ?? (await placeUser(place));
  const comment = options.comment?.trim() ? options.comment : undefined;
  // What they say is worth sending even with the status they gave already: it's a note on the review.
  if (!changesOwnStatus(review, user, status) && !comment) return true;
  const joining = user !== undefined && !isReviewer(review, user) ? user : undefined;
  if (joining && !options.joiningAgreed) {
    const confirmed = await confirm({
      title: `Mark as “${status}”`,
      message: "You aren't one of its reviewers yet. You'll be added as one.",
      confirmLabel: 'Add me and mark',
    });
    if (!confirmed) return false;
  }
  return runVoidAction(
    place,
    "Couldn't change your review status",
    async () => {
      if (joining) await api.codeReviews.addReviewers(place, review.id, [{ name: joining, kind: 'user' }]);
      await api.codeReviews.setOwnStatus(place, review.id, status, ...(comment ? [comment] : []));
    },
    isAffectedByTakingPartInReview,
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

/** Picks the review's reviewers in a dialog, as the page's picker does, and applies what changed. */
export async function chooseReviewers(place: Place, review: CodeReviewSummary): Promise<void> {
  const changes = await pickReviewers(review);
  if (changes) await changeReviewers(place, review, changes);
}

/** Adds and removes reviewers as the reviewer picker left them: one command for those added, one for those removed. */
export async function changeReviewers(place: Place, review: Pick<CodeReviewSummary, 'id'>, { add, remove }: ReviewerChanges): Promise<void> {
  if (add.length === 0 && remove.length === 0) return;
  await runAction(
    place,
    "Couldn't change the reviewers",
    async () => {
      if (add.length > 0) await api.codeReviews.addReviewers(place, review.id, add);
      if (remove.length > 0) await api.codeReviews.removeReviewers(place, review.id, remove);
    },
    // Someone added may be the user, or a group they're in: the server subscribes them.
    add.length > 0 ? isAffectedByTakingPartInReview : isAffectedByCodeReviews,
  );
}

export async function removeReviewer(place: Place, review: Pick<CodeReviewSummary, 'id'>, reviewer: MemberRef): Promise<void> {
  await runAction(place, "Couldn't remove the reviewer", () => api.codeReviews.removeReviewers(place, review.id, [reviewer]), isAffectedByCodeReviews);
}

/** Asks a reviewer, a user or a group, to review it again: their status goes back to "Under review". */
export async function reRequestReview(place: Place, review: Pick<CodeReviewSummary, 'id'>, reviewer: MemberRef): Promise<void> {
  await runAction(place, "Couldn't ask for a review again", () => api.codeReviews.reRequestReview(place, review.id, [reviewer]), isAffectedByCodeReviews);
}

/**
 * Subscribes the user to the review's emails (`subscribes`) or unsubscribes them. Only that review's subscription is
 * read again (`isAffectedByReviewSubscription`); until it answers, it shows as the server records the change
 * (`subscriptionAfter`), so the button doesn't flip back for a moment.
 */
export async function setReviewSubscription(place: Place, reviewId: number, subscribes: boolean): Promise<void> {
  await runAction(
    place,
    subscribes ? "Couldn't subscribe you to the review" : "Couldn't unsubscribe you from the review",
    async () => {
      await (subscribes ? api.codeReviews.subscribe(place, reviewId) : api.codeReviews.unsubscribe(place, reviewId));
      // Before the refresh `runAction` makes, which marks it to be read again after this.
      queryClient.setQueryData<ReviewSubscription>(reviewSubscriptionKey(place, reviewId), (shown) => shown && subscriptionAfter(shown, subscribes));
    },
    isAffectedByReviewSubscription(reviewId),
  );
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
