import type { LineRange } from '@shared/domain/reviewConversation';
import { lineBreakOf, splitLines } from '../../../lib/lineBreaks';
import { rangeWords } from '../rangeWords';

/** A line of an earlier version, shown with an outdated thread. */
export interface SnippetLine {
  number: number;
  text: string;
  /** A line the thread was written on. */
  commented: boolean;
}

/** Lines shown around the ones commented on: enough to recognize the code, little enough to stay a note. */
export const SNIPPET_CONTEXT = 2;

/** The most lines of a range shown: a comment on a whole function stays a note above the code, its first lines naming it. */
export const SNIPPET_MAX_COMMENTED = 10;

/**
 * The lines an outdated thread was written on, as its version had them: the lines and `context` lines each side, within
 * the file; of a long range, its first `SNIPPET_MAX_COMMENTED` lines, with no context after them. None when the lines
 * are past the version's end (a comment that never matched its text).
 */
export function snippetOf(text: string, { firstLine, lastLine }: LineRange, context = SNIPPET_CONTEXT): SnippetLine[] {
  const lines = splitLines(text);
  if (firstLine < 1 || firstLine > lines.length) return [];
  const commentedEnd = Math.min(lastLine, lines.length, firstLine + SNIPPET_MAX_COMMENTED - 1);
  const first = Math.max(1, firstLine - context);
  const last = commentedEnd < lastLine ? commentedEnd : Math.min(lines.length, lastLine + context);
  const snippet: SnippetLine[] = [];
  for (let number = first; number <= last; number++) {
    const withBreak = lines[number - 1]!;
    snippet.push({ number, text: withBreak.slice(0, withBreak.length - lineBreakOf(withBreak).length), commented: number >= firstLine && number <= lastLine });
  }
  return snippet;
}

/** What a screen reader hears of a snippet: "Line 12 as it was", "Lines 12–18 as they were". */
export function snippetLabel(lines: LineRange): string {
  return `${rangeWords(lines)} as ${lines.lastLine > lines.firstLine ? 'they were' : 'it was'}`;
}
