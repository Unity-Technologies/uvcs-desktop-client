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
  if (lines.kind === 'reading') return { enabled: false, tip: 'Reading the line…' };
  if (lines.kind === 'failed') return { enabled: false, tip: "The line's text can't be read" };
  if (holdsSuggestion(text)) return { enabled: false, tip: 'This comment already suggests a change' };
  return { enabled: true, tip: SUGGEST_TIP };
}

/**
 * What a comment opened from "Suggest change on line 42" does with its request, once it can tell: wait while the line
 * is read; insert the suggestion (`lines`); or say why it couldn't (`reason`, the button's tooltip), shown in the card,
 * so the menu never seems to do nothing.
 */
export type SuggestRequestOutcome = { kind: 'wait' } | { kind: 'insert'; lines: string[] } | { kind: 'refused'; reason: string };

export function suggestRequestOutcome(lines: ReplacedLines, text: string): SuggestRequestOutcome {
  if (lines.kind === 'reading') return { kind: 'wait' };
  const button = suggestButtonOf(lines, text);
  return button.enabled && lines.kind === 'read' ? { kind: 'insert', lines: lines.value } : { kind: 'refused', reason: button.tip };
}

/** The code menu's entry beside "Comment on line 42": the comment opened with the line's suggestion in it. */
export function suggestLineLabel(line: { lineNumber: number }): string {
  return `Suggest change on line ${line.lineNumber}`;
}
