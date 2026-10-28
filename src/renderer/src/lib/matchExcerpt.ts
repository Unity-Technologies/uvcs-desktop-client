import { queryWords } from './matchesAllWords';
import { wordMatchPositions } from './textMatchRanges';

/** Characters kept before the match, so it shows with a few words that lead to it. */
const CONTEXT_BEFORE = 24;
/** Characters kept from where the excerpt starts: more than any row shows, far less than a long description. */
const MAX_LENGTH = 200;

export interface Excerpt {
  text: string;
  /** The characters of `text` holding the words typed (`wordMatchPositions`), for `Highlight`. */
  matches: number[];
}

/**
 * A text on one line, starting a few words before the match and at most `MAX_LENGTH` long, so a row that cuts what it
 * shows at its end (a palette row's detail) still shows why it matched: "…and resolve owner names in one batch".
 */
export function excerptAroundMatch(text: string, query: string): Excerpt {
  const line = text.replace(/\s+/g, ' ').trim();
  const anchor = matchAnchor(line, query);
  const start = anchor > CONTEXT_BEFORE ? wordStartBefore(line, anchor - CONTEXT_BEFORE) : 0;
  const end = start + MAX_LENGTH;
  const shown = `${start > 0 ? '…' : ''}${line.slice(start, end)}${end < line.length ? '…' : ''}`;
  return { text: shown, matches: wordMatchPositions(shown, query) };
}

/**
 * Where the longest word typed that the line holds first shows (the earliest, among words as long): a short word is
 * often found inside others ("ls" in "false"), far from what was meant. -1 when no word shows.
 */
function matchAnchor(line: string, query: string): number {
  const lowered = line.toLowerCase();
  const found = queryWords(query)
    .map((word) => ({ length: word.length, index: lowered.indexOf(word) }))
    .filter(({ index }) => index !== -1)
    .sort((a, b) => b.length - a.length || a.index - b.index);
  return found[0]?.index ?? -1;
}

/** Where the word holding `position` starts; the text's start when that is its first word (never cut inside it). */
function wordStartBefore(line: string, position: number): number {
  return line.lastIndexOf(' ', position) + 1;
}
