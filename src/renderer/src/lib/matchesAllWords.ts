/** The words of a filter's query, lower case, in the order typed: what a row must hold and `Highlight` marks. */
export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** True when every word of the query appears somewhere in the text, in any order and case. For free text like comments. */
export function matchesAllWords(text: string, query: string): boolean {
  const words = queryWords(query);
  if (words.length === 0) return false;

  const haystack = text.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * A list filter over the texts a row shows: every word of the query in one of them (a blank query keeps every row).
 * `Highlight` marks the same words in each, so what is marked is what made the row match.
 */
export function matchesWordFilter(texts: readonly string[], query: string): boolean {
  return !query.trim() || matchesAllWords(texts.join('\n'), query);
}

/** How convincing a word match is, from 0 to 1, on the same scale as `fuzzyMatchQuality`. */
export function wordMatchQuality(text: string, query: string): number {
  if (!matchesAllWords(text, query)) return 0;
  const haystack = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.9;
  return haystack.includes(needle) ? 0.8 : 0.6;
}
