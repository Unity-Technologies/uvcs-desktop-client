import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { branchLabel } from '../../lib/branchLabels';
import { isActiveMergeRequest } from '../codeReviews/mergeRequestState';
import type { TaskMergeRequest } from '../mergeTask/taskMerge';

/**
 * A merge the server's merge rules refused (docs/features/merge-requests.md "Merging"): the source needs an open merge
 * request to the destination, or must be reviewed first. No `cm` command reads the rules: only the refusal tells.
 */
export interface MergeRuleRefusal {
  rule: 'needsMergeRequest' | 'needsReview';
  source: string;
  destination: string;
}

/*
 * The refusals' English text, the branch names quoted: a branch name can't hold a quote, so a quoted name runs to the
 * next one. `cm` translates them in other languages, where they stay unrecognized and its own message shows instead.
 */
const REFUSALS: readonly [MergeRuleRefusal['rule'], RegExp][] = [
  ['needsMergeRequest', /because of the Merge Rules\. Branch '([^']+)' needs an open merge request to '([^']+)'/],
  ['needsReview', /because of the Merge Rules\. Review the branch '([^']+)' to merge it to '([^']+)'/],
];

/** The merge rule a failed merge's message names; none for any other failure, or a message in another language. */
export function mergeRuleRefusal(message: string): MergeRuleRefusal | undefined {
  for (const [rule, pattern] of REFUSALS) {
    const match = pattern.exec(message);
    if (match) return { rule, source: match[1]!, destination: match[2]! };
  }
  return undefined;
}

/** The branch's merge request still to merge (Open or Draft) into `destination`, from the branch's reviews; none before they're read. */
export function mergeRequestInto(reviewsOfBranch: readonly CodeReviewSummary[] | undefined, destination: string): number | undefined {
  return reviewsOfBranch?.find((review) => isActiveMergeRequest(review) && review.mergeRequest?.destination === destination)?.id;
}

/** What the merge page says about a refusal, and the one thing to do about it. */
export interface MergeRuleNotice {
  title: string;
  action?: { kind: 'openMergeRequest'; reviewId: number; label: string };
}

/**
 * Whether the refused page reads the branch's reviews: only for a review rule, to find the merge request to open, and
 * only when the merge wasn't opened from it.
 */
export function needsBranchReviews({ rule }: MergeRuleRefusal, openedFrom: TaskMergeRequest | undefined): boolean {
  return rule === 'needsReview' && openedFrom === undefined;
}

/**
 * The refusal in a plain sentence, with its way forward: a request to review needs the merge request opened, the one
 * the merge was opened from, else the branch's into that destination (`mergeRequestInto`), once its reviews are read.
 */
export function mergeRuleNotice(
  { rule, destination }: MergeRuleRefusal,
  openedFrom: TaskMergeRequest | undefined,
  reviewsOfBranch: readonly CodeReviewSummary[] | undefined,
): MergeRuleNotice {
  const into = branchLabel(destination);
  if (rule === 'needsMergeRequest') return { title: `This server merges into ${into} only branches with an open merge request` };
  const mergeRequestId = openedFrom?.id ?? mergeRequestInto(reviewsOfBranch, destination);
  return {
    title: `This server merges into ${into} only reviewed branches`,
    ...(mergeRequestId !== undefined && { action: { kind: 'openMergeRequest', reviewId: mergeRequestId, label: 'Open merge request' } }),
  };
}
