import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft, type LucideIcon } from 'lucide-react';
import type { CodeReview, CodeReviewSummary, MergeRequestInfo, MergeRequestState } from '@shared/domain/codeReview';
import type { MenuWordId } from '../../components/menuWords';
import { describeTarget } from './reviewTarget';

/**
 * Each merge request state's glyph, wherever a state shows (`MergeRequestStateIcon`, its badge, the branch chips):
 * each its own shape, so the state never shows by color alone. Its color is the state's token
 * (`--merge-request-<state>`: `mergeRequestStateColors.module.css`; the Branch Explorer's `graphPalette`).
 */
export const MERGE_REQUEST_STATE_ICONS: Record<MergeRequestState, LucideIcon> = {
  Draft: GitPullRequestDraft,
  Open: GitPullRequest,
  Merged: GitMerge,
  Closed: GitPullRequestClosed,
};

type WithMergeRequest = Pick<CodeReviewSummary, 'mergeRequest'>;

/** A review that is a merge request. */
export type MergeRequestReview = CodeReviewSummary & { mergeRequest: MergeRequestInfo };

/** A merge request still to be merged: Open or Draft. A plain review is no merge request. */
export function isActiveMergeRequest(review: WithMergeRequest): boolean {
  const state = review.mergeRequest?.state;
  return state === 'Open' || state === 'Draft';
}

/** A move of a merge request's state the user can make, and the menu word it is offered as (`MENU_WORDS`). */
export interface MergeRequestMove {
  to: MergeRequestState;
  word: Extract<MenuWordId, 'readyForReview' | 'convertToDraft' | 'closeMergeRequest' | 'reopenMergeRequest'>;
}

/**
 * The moves each state takes, as the official clients offer them: a draft gets ready for review or is closed; an open
 * one goes back to draft or is closed; a closed one reopens. Closing asks nothing: Reopen undoes it. A merged one moves
 * no more (`cm` would take it back to Open, but its branch is merged already). Merged is never a move here: merging
 * records it.
 */
export function mergeRequestMoves(state: MergeRequestState): MergeRequestMove[] {
  switch (state) {
    case 'Draft':
      return [{ to: 'Open', word: 'readyForReview' }, CLOSE];
    case 'Open':
      return [{ to: 'Draft', word: 'convertToDraft' }, CLOSE];
    case 'Closed':
      return [{ to: 'Open', word: 'reopenMergeRequest' }];
    case 'Merged':
      return [];
  }
}

const CLOSE: MergeRequestMove = { to: 'Closed', word: 'closeMergeRequest' };

/** The title of the error a move that failed shows. */
export function moveFailureTitle({ word }: MergeRequestMove): string {
  return FAILURE_TITLES[word];
}

const FAILURE_TITLES: Record<MergeRequestMove['word'], string> = {
  readyForReview: "Couldn't mark the merge request ready for review",
  convertToDraft: "Couldn't convert the merge request to a draft",
  closeMergeRequest: "Couldn't close the merge request",
  reopenMergeRequest: "Couldn't reopen the merge request",
};

/** What a state icon's tooltip says: "Open merge request into /main", "Merged into /main". */
export function mergeRequestTip({ mergeRequest }: { mergeRequest: NonNullable<CodeReviewSummary['mergeRequest']> }): string {
  if (mergeRequest.state === 'Merged') return `Merged into ${mergeRequest.destination}`;
  return `${mergeRequest.state} merge request into ${mergeRequest.destination}`;
}

/** A review's source, and where it merges for a merge request: "/main/task → /main". */
export function describeMerge(source: string, review: WithMergeRequest): string {
  return review.mergeRequest ? `${source} → ${review.mergeRequest.destination}` : source;
}

/** What a review is called wherever it's named: "Merge request" or "Code review". */
export function reviewNoun(review: WithMergeRequest): 'Merge request' | 'Code review' {
  return review.mergeRequest ? 'Merge request' : 'Code review';
}

/** What a review's Changes show: a merge request's branch into its destination, a branch, or its changes in words. */
export type ReviewedChanges = { kind: 'merge'; source: string; destination: string } | { kind: 'branch'; branch: string } | { kind: 'text'; text: string };

export function reviewedChangesOf({ target, mergeRequest }: Pick<CodeReview, 'target' | 'mergeRequest'>): ReviewedChanges {
  if (target.kind !== 'branch') return { kind: 'text', text: describeTarget(target) };
  return mergeRequest ? { kind: 'merge', source: target.branch, destination: mergeRequest.destination } : { kind: 'branch', branch: target.branch };
}
