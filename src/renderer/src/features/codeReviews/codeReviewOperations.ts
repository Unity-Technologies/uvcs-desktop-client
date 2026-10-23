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
import { needsReviewerForStatus } from './reviewStatus';

/** `cm` keeps the status of a review nobody is assigned to, so one without a reviewer asks for one and sets both at once. */
export async function setReviewStatus(place: Place, review: CodeReviewSummary, status: CodeReviewStatus): Promise<void> {
  let assignee: string | undefined;
  if (needsReviewerForStatus(review)) {
    assignee = await prompt({
      title: `Mark as “${status}”`,
      label: 'Reviewer',
      initialValue: await suggestedReviewer(place),
      acceptInitialValue: true,
      description: 'A review needs a reviewer before its status can change.',
      confirmLabel: 'Assign and mark',
    });
    if (assignee === undefined) return;
  }
  await runAction(place, "Couldn't change the review status", () => api.codeReviews.update(place, review.id, { status, assignee }), isAffectedByCodeReviews);
}

/** Whoever changes the status is likely the one reviewing: you on the place's server, if already known or quick to read. */
async function suggestedReviewer(place: Place): Promise<string | undefined> {
  const server =
    place.kind === 'repository' ? serverOfRepository(place.repository) : queryClient.getQueryData<WorkspaceInfo>(queryKeys.inPlace(place, 'info'))?.server;
  return server ? readServerUser(server).catch(() => undefined) : undefined;
}

export async function reassignReview(place: Place, review: CodeReviewSummary): Promise<void> {
  const assignee = await prompt({
    title: 'Assign review',
    label: 'Reviewer',
    initialValue: review.assignee,
    description: 'The user who should review these changes.',
    confirmLabel: 'Assign',
  });
  if (assignee === undefined) return;
  await runAction(place, "Couldn't assign the review", () => api.codeReviews.update(place, review.id, { assignee }), isAffectedByCodeReviews);
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
