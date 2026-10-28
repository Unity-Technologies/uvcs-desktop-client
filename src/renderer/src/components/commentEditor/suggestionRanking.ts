import { filterHaystack, holdsEveryWord, queryWords } from '../../lib/matchesAllWords';

/**
 * How a suggestion list finds the best few of a list of thousands (20k branches) at each key typed: each list is read
 * into an index once (`indexCandidates`), lower-cased, and each query walks the index alone, never the objects. What
 * matches is what the item's list keeps for the same words (`matchesWordFilter` over the texts its row shows), so a
 * word finds the same objects after a trigger as in the view's filter; the names only order them.
 */
export interface CandidateIndex<T> {
  readonly candidates: readonly Candidate<T>[];
}

interface Candidate<T> {
  item: T;
  /** What names the item (a number, a branch's name and its last segment), lower-cased: matched first. */
  keys: readonly string[];
  /** What its list's filter looks through (`*FilterTexts`), joined and lower-cased as the filter does. */
  haystack: string;
}

/** `filterTextsOf`: the texts the item's list filters on, the same function its view uses. */
export function indexCandidates<T>(items: readonly T[], keysOf: (item: T) => readonly string[], filterTextsOf: (item: T) => readonly string[]): CandidateIndex<T> {
  return {
    candidates: items.map((item) => ({ item, keys: keysOf(item).map(lower), haystack: lower(filterHaystack(filterTextsOf(item))) })),
  };
}

/**
 * The best `limit` items for what was typed: those whose list keeps them for its words (`holdsEveryWord`), in four
 * tiers: a name that is it, a name that starts with it, a name that holds it, then the rest; the index's order within
 * a tier (newest first, where the lists are). Nothing typed: the first `limit`. One walk of the index, which never
 * stops early: the name typed may come last.
 */
export function rankCandidates<T>(index: CandidateIndex<T>, typed: string, limit: number): T[] {
  const query = lower(typed.trim());
  if (!query) return index.candidates.slice(0, limit).map((candidate) => candidate.item);
  const words = queryWords(typed);
  const tiers: T[][] = [[], [], [], []];
  for (const candidate of index.candidates) {
    if (!holdsEveryWord(candidate.haystack, words)) continue;
    const tier = tierOf(candidate, query);
    if (tiers[tier]!.length >= limit) continue;
    tiers[tier]!.push(candidate.item);
  }
  return tiers.flat().slice(0, limit);
}

function tierOf(candidate: Candidate<unknown>, query: string): number {
  if (candidate.keys.some((key) => key === query)) return 0;
  if (candidate.keys.some((key) => key.startsWith(query))) return 1;
  if (candidate.keys.some((key) => key.includes(query))) return 2;
  return 3;
}

function lower(text: string): string {
  return text.toLowerCase();
}
