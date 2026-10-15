/**
 * The longest line, in characters, the viewers draw unwrapped. Chromium draws nothing of a line of text past some
 * 1,300,000 characters, whatever its font (measured: 1.3M drawn, 1.4M blank), so the one line of a minified file of
 * 1.6 MB showed as an empty row; wrapped, each row is short and the text shows. Kept under that with room to spare.
 */
export const LONGEST_DRAWN_LINE = 1_000_000;

/** Whether any of the texts has a line too long to draw unwrapped (`LONGEST_DRAWN_LINE`): the view wraps it then. */
export function hasLineTooLongToDraw(texts: readonly string[]): boolean {
  return texts.some((text) => text.length > LONGEST_DRAWN_LINE && lineRanges(text).some(({ start, end }) => end - start > LONGEST_DRAWN_LINE));
}

/**
 * The text with each line too long to draw (`LONGEST_DRAWN_LINE`) cut there, an ellipsis saying so, for a view that
 * can't wrap it (annotate's rows are one line high each). Read-only: the text written back is never cut.
 */
export function withLongLinesCut(text: string): string {
  if (!hasLineTooLongToDraw([text])) return text;
  return lineRanges(text)
    .map(({ start, end, next }) => (end - start > LONGEST_DRAWN_LINE ? `${text.slice(start, start + LONGEST_DRAWN_LINE)}…${text.slice(end, next)}` : text.slice(start, next)))
    .join('');
}

/** Where each line starts and ends, and where the next one starts, past its break (LF, CRLF or a lone CR). */
function lineRanges(text: string): { start: number; end: number; next: number }[] {
  const ranges: { start: number; end: number; next: number }[] = [];
  let start = 0;
  for (const lineBreak of text.matchAll(/\r\n?|\n/g)) {
    const next = lineBreak.index + lineBreak[0].length;
    ranges.push({ start, end: lineBreak.index, next });
    start = next;
  }
  ranges.push({ start, end: text.length, next: text.length });
  return ranges;
}
