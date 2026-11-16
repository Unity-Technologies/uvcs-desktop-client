import type { LinkTarget } from './linkNavigation';

/**
 * A link to a review, written as a merge request's (`merge-requests/12`) when the review is known to be one; both
 * words open either (docs/features/deep-links.md). Which it is comes from the review the app already read, never a read
 * of its own: one not known is written as a code review's, which opens it all the same.
 */
export function withReviewKind(target: LinkTarget, isMergeRequest: (reviewId: number) => boolean): LinkTarget {
  const { object } = target;
  if (object?.kind !== 'codeReview' || object.asMergeRequest !== undefined || !isMergeRequest(object.id)) return target;
  return { ...target, object: { ...object, asMergeRequest: true } };
}
