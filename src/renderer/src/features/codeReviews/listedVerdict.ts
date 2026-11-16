import { reviewSectionOf } from './reviewSection';
import type { MergeRequestReview } from './mergeRequestState';
import { verdictOfSections, type MergeVerdict } from './mergeVerdict';

/**
 * A request's verdict where a list shows it (a branch's chip, the top bar, the Merge requests list), from the sections
 * a list knows: its review's today; checks join as they get data, read with the list. Only an Open request has one:
 * a draft isn't up for merging, a merged or closed one is done.
 */
export function listedVerdictOf(request: MergeRequestReview): MergeVerdict | undefined {
  if (request.mergeRequest.state !== 'Open') return undefined;
  return verdictOfSections([reviewSectionOf(request.reviewers, request.status)]);
}
