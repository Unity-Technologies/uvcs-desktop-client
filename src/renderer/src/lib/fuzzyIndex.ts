export interface FuzzyIndex {
  /** Indexes of the best matches, best first. An empty query returns the first `limit` texts. */
  rank(query: string, limit: number): number[];
}

interface Match {
  index: number;
  score: number;
}

/**
 * Fuzzy "go to anything" matching over many short texts (paths, names). Every query character must appear
 * in order; matches in the last path segment, at word starts and in a row score higher; shorter names, then paths, break ties.
 * Texts are lowercased once up front, so ranking hundreds of thousands of paths stays within a few frames. The queries
 * typed on the way to the current one are remembered: a query that extends one (typing on) only looks through the texts
 * that one matched, as they alone can match it, and deleting back to one answers at once.
 */
export function createFuzzyIndex(texts: readonly string[]): FuzzyIndex {
  const lowered = texts.map((text) => text.toLowerCase());
  // Where each lowered text's last segment starts, found the first time a ranking looks at it (-1 until then).
  const nameStarts = new Int32Array(texts.length).fill(-1);
  // Each needle extends the one before it; each holds every text it matched and its best ones.
  const typed: { needle: string; matched: number[]; limit: number; best: number[] }[] = [];

  function isBetter(a: Match, b: Match): boolean {
    if (a.score !== b.score) return a.score > b.score;
    const [textA, textB] = [texts[a.index]!, texts[b.index]!];
    const nameLengthA = textA.length - textA.lastIndexOf('/');
    const nameLengthB = textB.length - textB.lastIndexOf('/');
    return nameLengthA !== nameLengthB ? nameLengthA < nameLengthB : textA.length < textB.length;
  }

  return {
    rank(query, limit) {
      const needle = toNeedle(query);
      if (!needle) return texts.slice(0, limit).map((_, index) => index);

      while (typed.length > 0 && !needle.startsWith(typed.at(-1)!.needle)) typed.pop();
      const before = typed.at(-1);
      if (before?.needle === needle && before.limit === limit) return [...before.best];
      // Every text matching the needle has the letters of a needle it starts with, in order too.
      const candidates = before ? before.matched : null;
      const count = candidates ? candidates.length : lowered.length;
      const chars = [...needle];
      const matched: number[] = [];
      // Keeps only the best `limit` matches, sorted, instead of sorting every match.
      const best: Match[] = [];
      for (let candidate = 0; candidate < count; candidate++) {
        const index = candidates ? candidates[candidate]! : candidate;
        const text = lowered[index]!;
        let nameStart = nameStarts[index]!;
        if (nameStart === -1) nameStart = nameStarts[index] = text.lastIndexOf('/') + 1;
        const score = scoreText(text, needle, chars, nameStart);
        if (score === 0) continue;
        matched.push(index);

        const match = { index, score };
        if (best.length === limit && !isBetter(match, best[limit - 1]!)) continue;
        if (best.length === limit) best.pop();

        let position = best.length;
        while (position > 0 && isBetter(match, best[position - 1]!)) position--;
        best.splice(position, 0, match);
      }
      const indexes = best.map((match) => match.index);
      if (before?.needle === needle) typed.pop();
      typed.push({ needle, matched, limit, best: indexes });
      return [...indexes];
    },
  };
}

const WORD_SEPARATORS = new Set(['/', '.', '_', '-', ' ']);

/** Where the characters of `query` match in `text`, for highlighting a result the same way it was ranked. */
export function fuzzyMatchPositions(text: string, query: string): number[] {
  const haystack = text.toLowerCase();
  const needle = toNeedle(query);
  if (!needle) return [];

  const nameStart = haystack.lastIndexOf('/') + 1;
  const fromStart: number[] = [];
  const fromName: number[] = [];
  const chars = [...needle];
  const startScore = scoreFrom(haystack, needle, chars, 0, nameStart, fromStart);
  const nameScore = nameStart > 0 ? scoreFrom(haystack, needle, chars, nameStart, nameStart, fromName) : 0;
  if (startScore === 0 && nameScore === 0) return [];
  return nameScore > startScore ? fromName : fromStart;
}

/**
 * How convincing a match is, from 0 to 1, comparable across lists (files, branches, commands): the whole name,
 * its start or a run of it beat letters picked here and there, which score by how many start a word or continue a run.
 */
export function fuzzyMatchQuality(text: string, query: string): number {
  const needle = toNeedle(query);
  if (!needle) return 0;

  const haystack = text.toLowerCase();
  const name = haystack.slice(haystack.lastIndexOf('/') + 1);
  if (name === needle || haystack === needle) return 1;
  if (name.startsWith(needle)) return 0.9;
  if (name.includes(needle)) return 0.8;
  if (haystack.includes(needle)) return 0.7;

  const positions = fuzzyMatchPositions(text, query);
  const anchored = positions.filter(
    (position, index) => position === 0 || position === positions[index - 1]! + 1 || WORD_SEPARATORS.has(haystack[position - 1]!),
  );
  return (0.6 * anchored.length) / needle.length;
}

function toNeedle(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, '');
}

/** Matching from the start alone would let a letter early in the folders break up a run in the name, so try both. */
function scoreText(haystack: string, needle: string, chars: readonly string[], nameStart: number): number {
  return Math.max(scoreFrom(haystack, needle, chars, 0, nameStart), nameStart > 0 ? scoreFrom(haystack, needle, chars, nameStart, nameStart) : 0);
}

/**
 * Collects the matched indexes into `positions` when given; ranking leaves it out to avoid allocations.
 * Starts where the query appears whole, if it does: picking its first letters earlier would break the run.
 * `chars` are the needle's characters, split once per ranking.
 */
function scoreFrom(haystack: string, needle: string, chars: readonly string[], start: number, nameStart: number, positions?: number[]): number {
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
