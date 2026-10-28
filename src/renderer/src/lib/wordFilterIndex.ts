import { filterHaystack, holdsEveryWord, queryWords } from './matchesAllWords';

export interface WordFilterIndex {
  /**
   * The rows holding every word of `query` (`matchesWordFilter`'s rule), in the order the rows came, up to `limit`,
   * leaving out those `isShown` already. A blank query finds none.
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
      const found: number[] = [];
      for (let row = 0; row < haystacks.length && found.length < limit; row++) {
        if (!isShown(row) && holdsEveryWord(haystacks[row]!, words)) found.push(row);
      }
      return found;
    },
  };
}
