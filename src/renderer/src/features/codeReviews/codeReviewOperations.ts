import type { CodeReview, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';
import { needsReviewerForStatus } from './reviewStatus';

/** `cm` keeps the status of a review nobody is assigned to, so one without a reviewer asks for one and sets both at once. */
export async function setReviewStatus(workspacePath: string, review: CodeReviewSummary, status: CodeReviewStatus): Promise<void> {
  let assignee: string | undefined;
  if (needsReviewerForStatus(review)) {
    assignee = await prompt({
      title: `Mark as “${status}”`,
      label: 'Reviewer',
      description: 'A review needs a reviewer before its status can change.',
      confirmLabel: 'Assign and mark',
    });
    if (assignee === undefined) return;
  }
  await runAction(workspacePath, "Couldn't change the review status", () => api.codeReviews.update(workspacePath, review.id, { status, assignee }));
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
    title: reviews.length === 1 ? `Delete “${reviews[0]!.title}”?` : `Delete ${reviews.length} code reviews?`,
    message: 'The reviewed changes are kept. This cannot be undone.',
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
