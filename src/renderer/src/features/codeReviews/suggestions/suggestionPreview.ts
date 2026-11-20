import type { LineRange, ReviewComment } from '@shared/domain/reviewConversation';
import { commentLineText } from '../../../lib/comments/commentText';
import { rangeWordsInline } from '../../../lib/rangeWords';
import { suggestionOf } from '../../../lib/reviewSuggestion';

/** A comment's text opening with its suggestion's fence (any run of backticks or tildes, as Markdown takes). */
const OPENS_WITH_SUGGESTION = /^\s*(`{3,}|~{3,})[ \t]*suggestion[ \t]*(\r\n|\n|\r)/;

/**
 * A change request's text in one line (the Open list, the Comments panel, a folded thread, the chip of one applied):
 * its first line, or, for one that opens with its suggestion, "Suggested change on lines 24–152". The first line of
 * code it suggests (`{`, a method's signature) names nothing. `lines`: the lines it's on, none for one on the review.
 */
export function changeRequestLineText(text: string, lines: LineRange | undefined): string {
  return suggestionName(text, lines) ?? commentLineText(text);
}

/** `changeRequestLineText` for any comment: only a change request on lines suggests a change (`suggestedChangeOf`). */
export function commentLineTextOf(comment: Pick<ReviewComment, 'kind' | 'anchor' | 'text'>): string {
  return suggestionNameOf(comment) ?? commentLineText(comment.text);
}

/**
 * "Suggested change on lines 24–152" for a change request that opens with its suggestion, none for any other comment:
 * what shows in place of its first line where a line of it shows with its Markdown (`CommentLine`).
 */
export function suggestionNameOf(comment: Pick<ReviewComment, 'kind' | 'anchor' | 'text'>): string | null {
  return comment.kind === 'changeRequest' && comment.anchor.kind === 'line' ? suggestionName(comment.text, comment.anchor) : null;
}

function suggestionName(text: string, lines: LineRange | undefined): string | null {
  return lines && OPENS_WITH_SUGGESTION.test(text) && suggestionOf(text) ? `Suggested change on ${rangeWordsInline(lines)}` : null;
}
