import type { CodeReviewer, CodeReviewStatus } from '@shared/domain/codeReview';
import { pluralize } from '../../lib/text';
import type { MergeCardSection } from './mergeCard';

/**
 * Where the review stands, as the official clients word it, from the reviewers the review was read with: each counts
 * once, a group as one reviewer. A request with no reviewer can't be approved, so it asks for one.
 */
export function reviewSectionOf(reviewers: readonly CodeReviewer[], status: CodeReviewStatus): MergeCardSection {
  if (reviewers.length === 0) {
    return { id: 'review', tone: 'pending', title: 'Review required', detail: 'At least 1 approving review is required', action: { kind: 'addReviewers', label: 'Add reviewers' } };
  }
  const count = (each: CodeReviewStatus): number => reviewers.filter((reviewer) => reviewer.status === each).length;
  switch (status) {
    case 'Reviewed':
      return { id: 'review', tone: 'passed', title: 'Changes reviewed', detail: pluralize(count('Reviewed'), 'approving review') };
    case 'Rework required':
      return { id: 'review', tone: 'failed', title: 'Changes required', detail: `${pluralize(count('Rework required'), 'review')} requesting changes` };
    case 'Under review':
      return { id: 'review', tone: 'pending', title: 'Changes under review', detail: pluralize(count('Under review'), 'pending review') };
  }
}
