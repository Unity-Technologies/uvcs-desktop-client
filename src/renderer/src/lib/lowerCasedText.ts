/**
 * A text lower-cased as a filter's words are (`queryWords`), to find them in it, and where a slice found in it is in
 * the text itself: a letter may grow when lower-cased (a Turkish İ becomes i and a combining dot), moving every match
 * after it, so an index into the lower-cased text is not one into the text.
 */
export interface LowerCasedText {
  lower: string;
  /** Where the character at `lowerIndex` of `lower` was lower-cased from starts in the text. */
  originalIndex: (lowerIndex: number) => number;
  /** Where the slice `[lowerStart, lowerEnd)` of `lower` is in the text: the whole characters it was lower-cased from. */
  originalRange: (lowerStart: number, lowerEnd: number) => [start: number, end: number];
}

/**
 * Lower-cased whole when no letter grows, the common case, as the words typed are: a Greek Σ ending a word becomes ς
 * only so. Otherwise character by character, keeping where each came from.
 */
export function lowerCasedText(text: string): LowerCasedText {
  // Whole, not letter by letter, whenever it can be: `toLowerCase` reads a letter in its word, and a Σ ending one
  // becomes the final ς only so (alone it becomes σ). The words typed are lower-cased whole too (`queryWords`), so
  // "ΟΔΟΣ" typed finds "ΟΔΟΣ" written. Letter by letter only when a letter grows, rare, where an index must be mapped.
  const whole = text.toLowerCase();
  if (whole.length === text.length) return { lower: whole, originalIndex: (index) => index, originalRange: (start, end) => [start, end] };
  let lower = '';
  // For each code unit of `lower`, where the character it came from starts and ends in the text.
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  for (const character of text) {
    const lowered = character.toLowerCase();
    lower += lowered;
    for (let unit = 0; unit < lowered.length; unit++) {
      starts.push(at);
      ends.push(at + character.length);
    }
    at += character.length;
  }
  const originalIndex = (index: number): number => starts[index] ?? text.length;
  return { lower, originalIndex, originalRange: (start, end) => [originalIndex(start), end > start ? (ends[end - 1] ?? text.length) : originalIndex(start)] };
}
