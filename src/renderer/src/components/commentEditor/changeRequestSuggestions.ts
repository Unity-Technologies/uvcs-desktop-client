import type { LineRange } from '@shared/domain/reviewConversation';
import type { ReviewChangeRequest } from '../../features/codeReviews/changeRequests/changeRequests';
import { indexCandidates, rankCandidates, type CandidateIndex } from '../../lib/candidateRanking';
import { applyChangeText, shortGuid } from '../../lib/comments/commentReferences';
import { commentLineText } from '../../lib/comments/commentText';
import { lastSegment } from '../../lib/paths';
import { SUGGESTION_LIMIT, suggestionDetail, type Suggestion } from './suggestionItems';
import { rangeSpan } from '../../lib/rangeWords';

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
 * `[apply-change:c0d1ce00]`, which a check-in applies. Its tooltip names its number, the one that reference holds, over
 * its whole first line: the row has no room for either.
 */
export function changeRequestSuggestions(index: CandidateIndex<ReviewChangeRequest>, typed: string): Suggestion[] {
  return rankCandidates(index, typed, SUGGESTION_LIMIT).map((request) => ({
    key: `apply:${request.guid}`,
    kind: 'changeRequest',
    label: suggestionDetail(request.text, typed, LABEL_ROOM),
    detail: [...(request.location ? [locationText(request.location)] : []), `cr:${request.reviewId}`].join(' · '),
    owner: request.author,
    insert: applyChangeText(request.guid),
    tip: { text: `Change request ${shortGuid(request.guid)}`, sub: commentLineText(request.text) },
  }));
}

/** A change request's file as editors write it, with its lines when on lines: `Player.cs:12-18`, `Hero.png`. */
function locationText({ path, lines }: { path: string; lines?: LineRange }): string {
  return lines ? `${lastSegment(path)}:${rangeSpan(lines)}` : lastSegment(path);
}
