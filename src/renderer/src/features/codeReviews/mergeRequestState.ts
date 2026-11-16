import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft, type LucideIcon } from 'lucide-react';
import type { CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';

/**
 * Each merge request state's glyph, wherever a state shows (`MergeRequestStateIcon`, its badge, the branch chips):
 * each its own shape, so the state never shows by color alone. Its color is the state's token
 * (`--merge-request-<state>`, `mergeRequestStateColors.module.css`).
 */
export const MERGE_REQUEST_STATE_ICONS: Record<MergeRequestState, LucideIcon> = {
  Draft: GitPullRequestDraft,
  Open: GitPullRequest,
  Merged: GitMerge,
  Closed: GitPullRequestClosed,
};

/** Each state's color, for an inline style or a canvas: the same tokens the CSS reads. */
export const MERGE_REQUEST_STATE_COLORS: Record<MergeRequestState, string> = {
  Draft: 'var(--merge-request-draft)',
  Open: 'var(--merge-request-open)',
  Merged: 'var(--merge-request-merged)',
  Closed: 'var(--merge-request-closed)',
};

type WithMergeRequest = Pick<CodeReviewSummary, 'mergeRequest'>;

/** A merge request still to be merged: Open or Draft. A plain review is no merge request. */
export function isActiveMergeRequest(review: WithMergeRequest): boolean {
  const state = review.mergeRequest?.state;
  return state === 'Open' || state === 'Draft';
}

/** What a state icon's tooltip says: "Open merge request into /main", "Merged into /main". */
export function mergeRequestTip({ mergeRequest }: { mergeRequest: NonNullable<CodeReviewSummary['mergeRequest']> }): string {
  if (mergeRequest.state === 'Merged') return `Merged into ${mergeRequest.destination}`;
  return `${mergeRequest.state} merge request into ${mergeRequest.destination}`;
}

/** A review's source, and where it merges for a merge request: "/main/task → /main". */
export function describeMerge(source: string, review: WithMergeRequest): string {
  return review.mergeRequest ? `${source} → ${review.mergeRequest.destination}` : source;
}
