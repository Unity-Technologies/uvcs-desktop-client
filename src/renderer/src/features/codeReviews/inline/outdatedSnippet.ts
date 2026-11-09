import { lineBreakOf, splitLines } from '../../../lib/lineBreaks';

/** A line of an earlier version, shown with an outdated thread. */
export interface SnippetLine {
  number: number;
  text: string;
  /** The line the thread was written on. */
  commented: boolean;
}

/** Lines shown around the one commented on: enough to recognize the code, little enough to stay a note. */
export const SNIPPET_CONTEXT = 2;

/**
 * The lines an outdated thread was written on, as its version had them: the line and `context` lines each side, within
 * the file. None when the line is past the version's end (a comment that never matched its text).
 */
export function snippetOf(text: string, line: number, context = SNIPPET_CONTEXT): SnippetLine[] {
  const lines = splitLines(text);
  if (line < 1 || line > lines.length) return [];
  const first = Math.max(1, line - context);
  const last = Math.min(lines.length, line + context);
  const snippet: SnippetLine[] = [];
  for (let number = first; number <= last; number++) {
    const withBreak = lines[number - 1]!;
    snippet.push({ number, text: withBreak.slice(0, withBreak.length - lineBreakOf(withBreak).length), commented: number === line });
  }
  return snippet;
}
