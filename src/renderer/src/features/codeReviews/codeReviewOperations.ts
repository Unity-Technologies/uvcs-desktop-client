import type { CodeReview, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { readServerUser } from '../../app/account/accounts';
import { navigation } from '../../app/navigation/navigationStore';
import { queryClient } from '../../app/queryClient';
import { runAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { deleteReviewsQuestion } from './deleteReviewsQuestion';
import { needsReviewerForStatus } from './reviewStatus';

/** `cm` keeps the status of a review nobody is assigned to, so one without a reviewer asks for one and sets both at once. */
export async function setReviewStatus(workspacePath: string, review: CodeReviewSummary, status: CodeReviewStatus): Promise<void> {
  let assignee: string | undefined;
  if (needsReviewerForStatus(review)) {
    assignee = await prompt({
      title: `Mark as “${status}”`,
      label: 'Reviewer',
      initialValue: await suggestedReviewer(workspacePath),
      acceptInitialValue: true,
      description: 'A review needs a reviewer before its status can change.',
      confirmLabel: 'Assign and mark',
    });
    if (assignee === undefined) return;
  }
  await runAction(workspacePath, "Couldn't change the review status", () => api.codeReviews.update(workspacePath, review.id, { status, assignee }));
}

/** Whoever changes the status is likely the one reviewing: you on the workspace's server, if already known or quick to read. */
async function suggestedReviewer(workspacePath: string): Promise<string | undefined> {
  const server = queryClient.getQueryData<WorkspaceInfo>(queryKeys.inWorkspace(workspacePath, 'info'))?.server;
  return server ? readServerUser(server).catch(() => undefined) : undefined;
}

export async function reassignReview(workspacePath: string, review: CodeReviewSummary): Promise<void> {
  const assignee = await prompt({
    title: 'Assign review',
    label: 'Reviewer',
    initialValue: review.assignee,
    description: 'The user who should review these changes.',
    confirmLabel: 'Assign',
  });
  if (assignee === undefined) return;
  await runAction(workspacePath, "Couldn't assign the review", () => api.codeReviews.update(workspacePath, review.id, { assignee }));
}

/** Resolves to true when the reviews were deleted. */
export async function deleteReviews(workspacePath: string, reviews: CodeReviewSummary[]): Promise<boolean> {
  const confirmed = await confirm({
    ...deleteReviewsQuestion(reviews.map((review) => review.title)),
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return false;

  const deleted = await runAction(workspacePath, "Couldn't delete the review", async () => {
    await api.codeReviews.remove(workspacePath, reviews.map((review) => review.id));
    return true;
  });
  return deleted === true;
}

export function openReview(review: Pick<CodeReview, 'id'>, focusPath?: string): void {
  navigation.openPage({ kind: 'codeReview', reviewId: review.id, focusPath });
}
