import { holdsSuggestion } from '../../../lib/reviewSuggestion';
import type { ReplacedLines } from './suggestedChange';

/** What a new line comment's Suggest change offers: whether it can insert the fence now, and its tooltip saying so. */
export interface SuggestButton {
  enabled: boolean;
  tip: string;
}

/** The tooltip defining it, when it can insert. */
export const SUGGEST_TIP = "Add a suggestion: the line's new text, which the author can check in from the review";

/**
 * Whether Suggest change can fill a fence with the commented line's text (`lines`, the diff's own read): once it's
 * read, and once per comment, as only a comment's first suggestion is one (`suggestionOf`).
 */
export function suggestButtonOf(lines: ReplacedLines, text: string): SuggestButton {
  if (lines === 'reading') return { enabled: false, tip: 'Reading the line…' };
  if (lines === 'unknown') return { enabled: false, tip: "The line's text can't be read" };
  if (holdsSuggestion(text)) return { enabled: false, tip: 'This comment already suggests a change' };
  return { enabled: true, tip: SUGGEST_TIP };
}

/** The code menu's entry beside "Comment on line 42": the comment opened with the line's suggestion in it. */
export function suggestLineLabel(line: { lineNumber: number }): string {
  return `Suggest change on line ${line.lineNumber}`;
}
