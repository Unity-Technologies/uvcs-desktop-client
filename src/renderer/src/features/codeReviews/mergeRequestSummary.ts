import type { MergeRequestState } from '@shared/domain/codeReview';
import { commentLineText } from '../../lib/comments/commentText';
import { reviewSectionOf, type MergeCardSection } from './mergeCard';
import type { MergeRequestReview } from './mergeRequestState';
import { mergeVerbOf } from './reviewHeadline';

/**
 * What a merge request's summary card says (`MergeRequestSummaryCard`), wherever one is shown by a branch: the top
 * bar's card, a branch's chip in the Branches view and the Branch Explorer, a branch's details. Named by its title,
 * never by its number: the branch already has one (merge-requests.md "Its number").
 */
export interface MergeRequestSummary {
  /** The title's first line. */
  title: string;
  state: MergeRequestState;
  /** "leo wants to merge into /main": the owner, the verb (`mergeVerbOf`), the destination. */
  owner: string;
  verb: string;
  destination: string;
  /** Where its review stands, in the merge card's words (`reviewSectionOf`), with nothing to do from here. */
  review?: Pick<MergeCardSection, 'tone' | 'title' | 'detail'>;
}

export function mergeRequestSummaryOf(request: MergeRequestReview): MergeRequestSummary {
  const { state, destination } = request.mergeRequest;
  return {
    title: commentLineText(request.title),
    state,
    owner: request.owner,
    verb: `${mergeVerbOf(state)} into`,
    destination,
    ...(showsReview(request) && { review: reviewOf(request) }),
  };
}

/**
 * Open: where the review stands. Merged: how it went, once someone reviewed it ("Review required" would be wrong after
 * the fact). A draft isn't up for review, and a closed one is given up.
 */
function showsReview({ mergeRequest, reviewers }: MergeRequestReview): boolean {
  return mergeRequest.state === 'Open' || (mergeRequest.state === 'Merged' && reviewers.length > 0);
}

function reviewOf({ reviewers, status }: MergeRequestReview): NonNullable<MergeRequestSummary['review']> {
  const { tone, title, detail } = reviewSectionOf(reviewers, status);
  return { tone, title, ...(detail && { detail }) };
}
