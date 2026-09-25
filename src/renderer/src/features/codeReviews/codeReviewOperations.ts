import type { CodeReview, CodeReviewStatus, CodeReviewSummary, CodeReviewTarget } from '@shared/domain/codeReview';
import type { DiffTarget } from '@shared/domain/diff';
import { api } from '../../api/client';
import { navigation } from '../../app/navigation/navigationStore';
import { runAction } from '../../app/operations/runOperation';
import { confirm } from '../../ui/dialog/confirm';
import { prompt } from '../../ui/dialog/prompt';

export function setReviewStatus(workspacePath: string, review: CodeReviewSummary, status: CodeReviewStatus): Promise<unknown> {
  return runAction(workspacePath, "Couldn't change the review status", () => api.codeReviews.update(workspacePath, review.id, { status }));
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

export function describeTarget(target: CodeReviewTarget): string {
  switch (target.kind) {
    case 'branch':
      return target.branch;
    case 'changeset':
      return `Changeset ${target.changesetId}`;
    case 'unknown':
      return target.description;
  }
}

/** What to diff to review the changes, or null when the target is unknown. */
export function reviewDiffTarget(target: CodeReviewTarget): DiffTarget | null {
  switch (target.kind) {
    case 'branch':
      return { kind: 'branch', branch: target.branch };
    case 'changeset':
      return { kind: 'changeset', changesetId: target.changesetId };
    case 'unknown':
      return null;
  }
}
