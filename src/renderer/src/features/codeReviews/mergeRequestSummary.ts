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
  review?: Pick<MergeCardSection, 'tone' | 'status' | 'title' | 'detail'>;
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
 * Open: where the review stands. Merged: how it went, once it was decided (reviewed, or changes required): "Review
 * required" or "Changes under review" would be wrong on finished work, which merged whatever the review said. A draft
 * isn't up for review, and a closed one is given up.
 */
function showsReview({ mergeRequest, status }: MergeRequestReview): boolean {
  return mergeRequest.state === 'Open' || (mergeRequest.state === 'Merged' && status !== 'Under review');
}

function reviewOf({ reviewers, status }: MergeRequestReview): NonNullable<MergeRequestSummary['review']> {
  const section = reviewSectionOf(reviewers, status);
  return { tone: section.tone, ...(section.status && { status: section.status }), title: section.title, ...(section.detail && { detail: section.detail }) };
}
