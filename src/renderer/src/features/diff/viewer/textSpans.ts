/**
 * Spans of a text as Pierre shows it (`shownText`): lines broken at LF, a CR before one shown as part of nothing.
 * Positions are zero-based lines and characters (UTF-16 code units), as Pierre's editor gives its selections, and are
 * clamped to the text: a selection read from the page may end past what a line holds.
 */
export interface TextPosition {
  line: number;
  character: number;
}

export interface TextSpan {
  start: TextPosition;
  end: TextPosition;
}

/** The span with its start first, however it was selected (backwards, from the end). */
export function orderedSpan({ start, end }: TextSpan): TextSpan {
  const backwards = end.line < start.line || (end.line === start.line && end.character < start.character);
  return backwards ? { start: end, end: start } : { start, end };
}

export function isEmptySpan({ start, end }: TextSpan): boolean {
  return start.line === end.line && start.character === end.character;
}

/** The text a span holds, its lines joined by LF whatever the text's own line breaks. */
export function spanText(text: string, span: TextSpan): string {
  const lines = shownLines(text);
  const { start, end } = clampedSpan(lines, orderedSpan(span));
  if (start.line === end.line) return lines[start.line]!.slice(start.character, end.character);
  const first = lines[start.line]!.slice(start.character);
  const middle = lines.slice(start.line + 1, end.line);
  const last = lines[end.line]!.slice(0, end.character);
  return [first, ...middle, last].join('\n');
}

/**
 * The one-based lines a span covers, as a line number reads them: a span ending at the start of a line (dragged to the
 * end of the line above, or whole lines selected) doesn't cover that line.
 */
export function spanLines(span: TextSpan): { first: number; last: number } {
  const { start, end } = orderedSpan(span);
  const endsAtLineStart = end.character === 0 && end.line > start.line;
  return { first: start.line + 1, last: endsAtLineStart ? end.line : end.line + 1 };
}

/** The span of the whole text. */
export function wholeTextSpan(text: string): TextSpan {
  const lines = shownLines(text);
  const last = lines.length - 1;
  return { start: { line: 0, character: 0 }, end: { line: last, character: lines[last]!.length } };
}

/** How many lines a text shows: a final line break ends the last line, and an empty text still has one. */
export function shownLineCount(text: string): number {
  const lines = shownLines(text);
  return lines.length > 1 && lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

/** The lines of a text, without their line breaks: a CR before a LF, which Pierre doesn't show, is no character. */
function shownLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

function clampedSpan(lines: string[], { start, end }: TextSpan): TextSpan {
  return { start: clampedPosition(lines, start), end: clampedPosition(lines, end) };
}

function clampedPosition(lines: string[], { line, character }: TextPosition): TextPosition {
  const clampedLine = Math.min(Math.max(line, 0), lines.length - 1);
  return { line: clampedLine, character: Math.min(Math.max(character, 0), lines[clampedLine]!.length) };
}
