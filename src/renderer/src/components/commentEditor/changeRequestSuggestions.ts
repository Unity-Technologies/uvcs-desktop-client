import type { ReviewChangeRequest } from '../../features/codeReviews/changeRequests/changeRequests';
import { indexCandidates, rankCandidates, type CandidateIndex } from '../../lib/candidateRanking';
import { applyChangeText, shortGuid } from '../../lib/comments/commentReferences';
import { lastSegment } from '../../lib/paths';
import { SUGGESTION_LIMIT, suggestionDetail, type Suggestion } from './suggestionItems';

/** How many characters of a request's first line its row shows: it leads the row, where an object's number would. */
const LABEL_ROOM = 48;

/**
 * The change requests to apply, read into an index once per read (`indexCandidates`): by their number (the guid's first
 * eight digits a comment writes), and by what their row shows: the request's words, its file, its review, who asked, its number.
 * Kept in the order given, the newest first (`openChangeRequests`).
 */
export function changeRequestIndex(requests: readonly ReviewChangeRequest[]): CandidateIndex<ReviewChangeRequest> {
  return indexCandidates(requests, (request) => [shortGuid(request.guid)], (request) => [request.text, request.location?.path ?? '', `cr:${request.reviewId}`, request.author, shortGuid(request.guid)]);
}

/**
 * The rows of the change requests to apply (docs/features/rich-comments.md, "Suggestions"): each request's first line,
 * its file and line when it has one and its review (`cr:43`), who asked; a pick writes `cm`'s own reference,
 * `[apply-change:c0d1ce00]`, which a check-in applies.
 */
export function changeRequestSuggestions(index: CandidateIndex<ReviewChangeRequest>, typed: string): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((request) => ({
    key: `apply:${request.guid}`,
    kind: 'changeRequest',
    label: suggestionDetail(request.text, typed, LABEL_ROOM),
    detail: [...(request.location ? [`${lastSegment(request.location.path)}:${request.location.line}`] : []), `cr:${request.reviewId}`].join(' · '),
    owner: request.author,
    insert: applyChangeText(request.guid),
  }));
}
