/**
 * A one-line field's text (a merge's comment, a review's title): pasted lines joined by a space, as an `<input>`
 * would take them.
 */
export function oneLineText(text: string): string {
  return text.replace(/[^\S\r\n]*(?:\r\n?|\n)\s*/g, ' ');
}

/**
 * The change that makes the editor's text `next` (what the field was given: a recent comment picked, a changelist's
 * comment, the draft of another workspace), touching only what differs, so the caret stays where it was in the rest.
 * Line ends as the editor keeps them (`\n`). Null when they're the same.
 */
export function changeToMatch(current: string, next: string): { from: number; to: number; insert: string } | null {
  const wanted = next.replace(/\r\n?/g, '\n');
  if (wanted === current) return null;
  let start = 0;
  while (start < current.length && start < wanted.length && current[start] === wanted[start]) start++;
  let end = 0;
  while (end < current.length - start && end < wanted.length - start && current[current.length - 1 - end] === wanted[wanted.length - 1 - end]) end++;
  return { from: start, to: current.length - end, insert: wanted.slice(start, wanted.length - end) };
}
