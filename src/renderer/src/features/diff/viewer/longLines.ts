/**
 * The longest line, in characters, the viewers draw unwrapped. Chromium draws nothing of a line of text past some
 * 1,300,000 characters, whatever its font (measured: 1.3M drawn, 1.4M blank), so the one line of a minified file of
 * 1.6 MB showed as an empty row; wrapped, each row is short and the text shows. Kept under that with room to spare.
 */
export const LONGEST_DRAWN_LINE = 1_000_000;

/**
 * The longest line, in characters, typed into in the app (`hasLineTooLongToEdit`). Pierre's editor takes time by the
 * square of a wrapped line's length at each keystroke (measured: 100,000 characters 0.24 s a key, 300,000 3 s, 700,000
 * 18 s, 2 MB more than three minutes); unwrapped, 700,000 took 70 ms, but the user may wrap any line.
 */
export const LONGEST_EDITED_LINE = 50_000;

const LINE_BREAK = /\r\n?|\n/g;

/** Whether any of the texts has a line too long to draw unwrapped (`LONGEST_DRAWN_LINE`): the view wraps it then. */
export function hasLineTooLongToDraw(texts: readonly string[]): boolean {
  return hasLineLongerThan(texts, LONGEST_DRAWN_LINE);
}

/** Whether any of the texts has a line too long to type into (`LONGEST_EDITED_LINE`): it's shown read-only then. */
export function hasLineTooLongToEdit(texts: readonly string[]): boolean {
  return hasLineLongerThan(texts, LONGEST_EDITED_LINE);
}

function hasLineLongerThan(texts: readonly string[], limit: number): boolean {
  return texts.some((text) => text.length > limit && hasLongLine(text, limit));
}

/**
 * The text with each line too long to draw (`LONGEST_DRAWN_LINE`) cut there, an ellipsis saying so, for a view that
 * can't wrap it (annotate's rows are one line high each). Read-only: the text written back is never cut.
 */
export function withLongLinesCut(text: string): string {
  if (!hasLineTooLongToDraw([text])) return text;
  return text.replace(/[^\r\n]+/g, (line) => (line.length > LONGEST_DRAWN_LINE ? `${cutAt(line, LONGEST_DRAWN_LINE)}…` : line));
}

/** Whether a line is longer than `limit`, found from the line breaks (LF, CRLF or a lone CR), stopping at the first. */
function hasLongLine(text: string, limit: number): boolean {
  let start = 0;
  for (const lineBreak of text.matchAll(LINE_BREAK)) {
    if (lineBreak.index - start > limit) return true;
    start = lineBreak.index + lineBreak[0].length;
  }
  return text.length - start > limit;
}

/** The first `length` code units of `line`, one fewer when the last would be half of a character written in two. */
function cutAt(line: string, length: number): string {
  const last = line.charCodeAt(length - 1);
  return line.slice(0, last >= 0xd800 && last <= 0xdbff ? length - 1 : length);
}
