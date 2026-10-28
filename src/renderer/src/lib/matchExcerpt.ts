import { wordMatchPositions, wordMatchRanges } from './textMatchRanges';

/** Characters kept before the first match, so it shows with a few words that lead to it. */
const CONTEXT_BEFORE = 24;

export interface Excerpt {
  text: string;
  /** The characters of `text` holding the words typed (`wordMatchPositions`), for `Highlight`. */
  matches: number[];
}

/**
 * A text on one line, starting a few words before the first word of `query` it holds, so a row that cuts what it
 * shows at its end (a palette row's detail) still shows why it matched: "…and resolve owner names in one batch".
 */
export function excerptAroundMatch(text: string, query: string): Excerpt {
  const line = text.replace(/\s+/g, ' ').trim();
  const [first] = wordMatchRanges(line, query);
  const start = first && first[0] > CONTEXT_BEFORE ? wordStartBefore(line, first[0] - CONTEXT_BEFORE) : 0;
  const shown = start > 0 ? `…${line.slice(start)}` : line;
  return { text: shown, matches: wordMatchPositions(shown, query) };
}

/** Where the word holding `position` starts; `position` itself in a text without a space before it. */
function wordStartBefore(line: string, position: number): number {
  const space = line.lastIndexOf(' ', position);
  return space === -1 ? position : space + 1;
}
