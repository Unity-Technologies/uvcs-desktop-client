// Fuzzy matching of short texts (paths, names) as "go to anything" ranks them, shared by the renderer's lists
// (`createFuzzyIndex`) and the main process's searches that never hold a whole list (a repository's files).

export const WORD_SEPARATORS: ReadonlySet<string> = new Set(['/', '.', '_', '-', ' ']);

/** The query as matched: lowercased, its spaces out. Empty: nothing to match. */
export function toNeedle(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, '');
}

/** Matching from the start alone would let a letter early in the folders break up a run in the name, so try both. */
export function scoreText(haystack: string, needle: string, chars: readonly string[], nameStart: number): number {
  return Math.max(scoreFrom(haystack, needle, chars, 0, nameStart), nameStart > 0 ? scoreFrom(haystack, needle, chars, nameStart, nameStart) : 0);
}

/**
 * Collects the matched indexes into `positions` when given; ranking leaves it out to avoid allocations.
 * Starts where the query appears whole, if it does: picking its first letters earlier would break the run.
 * `chars` are the needle's characters, split once per ranking.
 */
export function scoreFrom(haystack: string, needle: string, chars: readonly string[], start: number, nameStart: number, positions?: number[]): number {
  let score = 1;
  const run = haystack.indexOf(needle, start);
  let position = (run === -1 ? start : run) - 1;

  for (let i = 0; i < chars.length; i++) {
    const found = haystack.indexOf(chars[i]!, position + 1);
    if (found === -1) return 0;

    if (found === position + 1) score += 3;
    if (found >= nameStart) score += 2;
    if (found === 0 || WORD_SEPARATORS.has(haystack[found - 1]!)) score += 2;
    positions?.push(found);
    position = found;
  }
  return score;
}

/** A text's score for a needle (`toNeedle`): 0 when it doesn't match. `lowered` is the text lowercased. */
export function scoreOf(lowered: string, needle: string): number {
  return scoreText(lowered, needle, [...needle], lowered.lastIndexOf('/') + 1);
}

/**
 * Whether a match ranks before another of the same needle: the higher score, then the shorter name, then the shorter
 * path. `a` and `b` are the texts as written.
 */
export function ranksBefore(a: { text: string; score: number }, b: { text: string; score: number }): boolean {
  if (a.score !== b.score) return a.score > b.score;
  const nameLengthA = a.text.length - a.text.lastIndexOf('/');
  const nameLengthB = b.text.length - b.text.lastIndexOf('/');
  return nameLengthA !== nameLengthB ? nameLengthA < nameLengthB : a.text.length < b.text.length;
}
