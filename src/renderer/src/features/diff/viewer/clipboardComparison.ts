import { lastSegment } from '../../../lib/paths';
import { codeComparison, type CodeComparison } from './codeComparison';
import type { ComparisonMethod } from './comparisonMethod';
import { isEmptySpan, spanLines, spanText, type TextSpan } from './textSpans';

/**
 * Code selected, to compare with the clipboard ("Compare with clipboard"): its text as it shows (lines joined by LF:
 * line breaks don't show, so they don't count), and where it is, to name it.
 */
export interface CodeFragment {
  /** The file's name or path; its last part names it. */
  fileName: string;
  /** The version of the file in a diff, older or newer; null for a file shown alone (the whole-file editor, a merge). */
  side: 'old' | 'new' | null;
  /** One-based, as the line numbers read. */
  lines: { first: number; last: number };
  text: string;
}

/** Where a fragment comes from: the file, its side in a diff, and the side's text. */
export interface FragmentSource {
  fileName: string;
  side: CodeFragment['side'];
  text: string;
}

/** The text selected in a source, to the character; none for a caret, which selects nothing. */
export function fragmentOfSpan(source: FragmentSource, span: TextSpan): CodeFragment | null {
  if (isEmptySpan(span)) return null;
  return { fileName: source.fileName, side: source.side, lines: spanLines(span), text: spanText(source.text, span) };
}

/** Whole lines selected in a source (a click on a line number, Shift+click a range). */
export function fragmentOfLines(source: FragmentSource, lines: { first: number; last: number }): CodeFragment {
  const span = { start: { line: lines.first - 1, character: 0 }, end: { line: lines.last, character: 0 } };
  const text = spanText(source.text, span);
  return { fileName: source.fileName, side: source.side, lines, text: text.endsWith('\n') ? text.slice(0, -1) : text };
}

/**
 * The clipboard's text to compare, its line breaks LF as the selection's (text copied on Windows comes with CRLF); none
 * when it holds no text (empty, or only an image or files, which the page reads as empty).
 */
export function clipboardText(read: string): string | null {
  return read === '' ? null : read.replace(/\r\n|\r/g, '\n');
}

/**
 * What "Compare with clipboard" opens: the clipboard on the left, as what came before, and the selection on the right.
 * The title names the lines, the line under it the file and, where a diff shows two, its version.
 */
export function clipboardComparison(clipboard: string, selection: CodeFragment, comparisonMethod: ComparisonMethod) {
  const { first, last } = selection.lines;
  const lines = first === last ? `line ${first}` : `lines ${first}–${last}`;
  return {
    title: `Clipboard compared with ${lines}`,
    description: `${lastSegment(selection.fileName)}${versionWords(selection.side)}`,
    // Each ends its last line, so the diff says nothing of a final line break neither text was about.
    comparison: codeComparison(endLine(clipboard), endLine(selection.text), comparisonMethod, selection.fileName, 'The clipboard holds the selected text') satisfies CodeComparison,
    fileName: selection.fileName,
  };
}

function versionWords(side: CodeFragment['side']): string {
  if (side === null) return '';
  return side === 'old' ? ' (before)' : ' (after)';
}

function endLine(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}
