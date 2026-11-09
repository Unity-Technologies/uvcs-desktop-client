import { filterHaystack, holdsEveryWord, queryWords } from './matchesAllWords';

export interface WordFilterIndex {
  /**
   * The rows holding every word of `query` (`matchesWordFilter`'s rule), up to `limit`, leaving out those `isShown`
   * already: first those holding the words together as typed, then the rest, each in the order the rows came, from
   * the whole list (one look at each row). A blank query finds none.
   */
  matching(query: string, limit: number, isShown: (row: number) => boolean): number[];
}

/**
 * A list filter (`matchesWordFilter`) over many rows that answers every keystroke: each row's texts (what it shows,
 * e.g. a branch's name and description) are joined and lower-cased once, here, instead of on every query.
 */
export function createWordFilterIndex(rows: readonly (readonly string[])[]): WordFilterIndex {
  const haystacks = rows.map((texts) => filterHaystack(texts).toLowerCase());
  return {
    matching(query, limit, isShown) {
      const words = queryWords(query);
      const typed = words.join(' ');
      // What `wordMatchQuality` ranks higher: the words together, as typed, over the words apart.
      const together: number[] = [];
      const apart: number[] = [];
      for (let row = 0; row < haystacks.length && together.length < limit; row++) {
        const haystack = haystacks[row]!;
        if (isShown(row) || !holdsEveryWord(haystack, words)) continue;
        if (words.length === 1 || haystack.includes(typed)) together.push(row);
        else if (apart.length < limit) apart.push(row);
      }
      return [...together, ...apart].slice(0, limit);
    },
  };
}
