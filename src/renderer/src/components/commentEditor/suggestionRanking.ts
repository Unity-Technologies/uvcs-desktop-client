/**
 * How a suggestion list finds the best few of a list of thousands (20k branches) at each key typed: each list is read
 * into an index once (`indexCandidates`), lower-cased, and each query walks the index alone, never the objects.
 */
export interface CandidateIndex<T> {
  readonly candidates: readonly Candidate<T>[];
}

interface Candidate<T> {
  item: T;
  /** What names the item (a number, a branch's name and its last segment), lower-cased: matched first. */
  keys: readonly string[];
  /** What describes it (a comment's first line, an emoji's tags), lower-cased: matched last. */
  texts: readonly string[];
}

export function indexCandidates<T>(items: readonly T[], keysOf: (item: T) => readonly string[], textsOf: (item: T) => readonly string[] = () => []): CandidateIndex<T> {
  return {
    candidates: items.map((item) => ({ item, keys: keysOf(item).map(lower), texts: textsOf(item).map(lower) })),
  };
}

/**
 * The best `limit` items for what was typed, in three tiers: a name that starts with it, a name that holds it, then a
 * description that holds it; the index's order within a tier (newest first, where the lists are). Nothing typed: the
 * first `limit`. The walk ends as soon as the first tier is full.
 */
export function rankCandidates<T>(index: CandidateIndex<T>, typed: string, limit: number): T[] {
  const query = lower(typed);
  if (!query) return index.candidates.slice(0, limit).map((candidate) => candidate.item);
  const tiers: T[][] = [[], [], []];
  for (const candidate of index.candidates) {
    const tier = tierOf(candidate, query);
    if (tier < 0 || tiers[tier]!.length >= limit) continue;
    tiers[tier]!.push(candidate.item);
    if (tier === 0 && tiers[0]!.length >= limit) break;
  }
  return tiers.flat().slice(0, limit);
}

function tierOf(candidate: Candidate<unknown>, query: string): number {
  if (candidate.keys.some((key) => key.startsWith(query))) return 0;
  if (candidate.keys.some((key) => key.includes(query))) return 1;
  if (candidate.texts.some((text) => text.includes(query))) return 2;
  return -1;
}

function lower(text: string): string {
  return text.toLowerCase();
}
