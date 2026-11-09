import { wordMatchRanges } from './textMatchRanges';

/** How much of what comes before the match a cut start keeps, at most: enough to read where it is. */
const LEAD = 20;

/**
 * `text` as a row that shows its first `maxChars` characters shows it, the first match of `query` (`wordMatchRanges`,
 * what `Highlight` marks) in sight: as it is when the match ends within the room, else cut at its start, at a word
 * when one starts close enough before the match, after an ellipsis. The row still cuts the end. Never splits a
 * character in two.
 */
export function matchWindow(text: string, query: string, maxChars: number): string {
  const [first] = wordMatchRanges(text, query);
  if (!first || first[1] <= maxChars) return text;
  const [start, end] = first;
  const room = maxChars - 1 - (end - start);
  let from = Math.max(0, start - Math.min(LEAD, Math.max(0, room)));
  const wordStart = text.slice(from, start).search(/\s\S/);
  // At a word that starts before the match, or at the match itself: never in the middle of a word.
  if (wordStart >= 0) from += wordStart + 1;
  else if (from > 0 && !/\s/.test(text[from - 1]!)) from = start;
  if (isLowSurrogate(text.charCodeAt(from))) from -= 1;
  return `…${text.slice(from)}`;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
