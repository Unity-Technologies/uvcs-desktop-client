/**
 * A text lower-cased as a filter's words are (`queryWords`), to find them in it, and where a slice found in it is in
 * the text itself: a letter may grow when lower-cased (a Turkish İ becomes i and a combining dot), moving every match
 * after it, so an index into the lower-cased text is not one into the text.
 */
export interface LowerCasedText {
  lower: string;
  /** Where the slice `[lowerStart, lowerEnd)` of `lower` is in the text: the whole characters it was lower-cased from. */
  originalRange: (lowerStart: number, lowerEnd: number) => [start: number, end: number];
}

/**
 * Lower-cased whole when no letter grows, the common case, as the words typed are: a Greek Σ ending a word becomes ς
 * only so. Otherwise character by character, keeping where each came from.
 */
export function lowerCasedText(text: string): LowerCasedText {
  const whole = text.toLowerCase();
  if (whole.length === text.length) return { lower: whole, originalRange: (start, end) => [start, end] };
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
  return {
    lower,
    originalRange: (start, end) => [starts[start] ?? text.length, end > start ? (ends[end - 1] ?? text.length) : (starts[start] ?? text.length)],
  };
}
