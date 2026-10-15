/**
 * The longest line, in characters, the viewers draw unwrapped. Chromium draws nothing of a line of text past some
 * 1,300,000 characters, whatever its font (measured: 1.3M drawn, 1.4M blank), so the one line of a minified file of
 * 1.6 MB showed as an empty row; wrapped, each row is short and the text shows. Kept under that with room to spare.
 */
export const LONGEST_DRAWN_LINE = 1_000_000;

/** Whether any of the texts has a line too long to draw unwrapped (`LONGEST_DRAWN_LINE`): the view wraps it then. */
export function hasLineTooLongToDraw(texts: readonly string[]): boolean {
  return texts.some((text) => text.length > LONGEST_DRAWN_LINE && longestLine(text) > LONGEST_DRAWN_LINE);
}

/** The length of the text's longest line, found from its line breaks (LF, CRLF or a lone CR) without splitting it. */
function longestLine(text: string): number {
  let longest = 0;
  let start = 0;
  for (const lineBreak of text.matchAll(/\r\n?|\n/g)) {
    longest = Math.max(longest, lineBreak.index - start);
    start = lineBreak.index + lineBreak[0].length;
  }
  return Math.max(longest, text.length - start);
}
