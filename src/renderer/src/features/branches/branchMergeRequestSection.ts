import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { canMergeSomewhere } from '../codeReviews/mergeRequestDraft';
import { asMergeRequest, isActiveMergeRequest, type MergeRequestReview } from '../codeReviews/mergeRequestState';

/**
 * What a branch's details show under Merge request (docs/features/merge-requests.md "A branch's merge request at a
 * glance"): its request's card, "No merge request", a placeholder while its review is read, or no section. `canCreate`
 * offers New at the title's right while the branch has no request still to merge.
 */
export type BranchMergeRequestSection =
  | { body: 'hidden' }
  | { body: 'reading'; canCreate: false }
  | { body: 'none'; canCreate: true }
  | { body: 'card'; request: MergeRequestReview; canCreate: boolean };

/**
 * The section for `branch`, from the review that stands for it (`useBranchReview`: none yet while it's read, null when
 * it has none). That review is a request still to merge whenever the branch has one (`reviewOfEachBranch`), so a merged,
 * closed or plain one means there's none to merge and a new one can be made. A branch with nowhere to merge (`/main`,
 * `canMergeSomewhere`) can't have one, so it shows no section unless a request names it anyway.
 */
export function branchMergeRequestSectionOf(branch: Pick<Branch, 'name' | 'parent'>, review: CodeReviewSummary | null | undefined): BranchMergeRequestSection {
  const canMerge = canMergeSomewhere(branch);
  const request = asMergeRequest(review ?? undefined);
  if (request) return { body: 'card', request, canCreate: canMerge && !isActiveMergeRequest(request) };
  if (!canMerge) return { body: 'hidden' };
  if (review === undefined) return { body: 'reading', canCreate: false };
  return { body: 'none', canCreate: true };
}
