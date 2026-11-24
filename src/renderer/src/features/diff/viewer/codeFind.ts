import type { DiffSide } from './changeBlocks';
import type { MarkRange, WordMarksByLine } from './wordMarkRows';

/**
 * Finding text in a read-only side of a diff (`useCodeFind`, `CodeFindBar`): the side typed into has Pierre's own search
 * panel, which only its editor has, so every other side gets this one, with the same options and colors.
 */

/** How the text typed is matched. */
export interface FindOptions {
  matchCase: boolean;
  /** Only where the text stands as a word of its own: no letter, digit or underscore just before or after it. */
  wholeWord: boolean;
}

/** Where a match is: its line, one-based, and its characters in that line (UTF-16, as the page counts them), `[start, end)`. */
export interface CodeMatch {
  line: number;
  start: number;
  end: number;
}

/** The matches of a search, in the order of the text, and whether there were more than it kept. */
export interface FoundMatches {
  matches: CodeMatch[];
  capped: boolean;
}

/**
 * The most matches a search keeps: a letter typed into a huge file matches millions of times, and the count says
 * "10,000+" past this. Each match is drawn only while its row is on screen, so what's kept is what costs.
 */
export const MAX_MATCHES = 10_000;

const NOTHING_FOUND: FoundMatches = { matches: [], capped: false };

/**
 * Every place `query` stands in `text`, line by line (a match never spans a line break: LF, CRLF or a lone CR, as
 * Pierre breaks the lines it shows). Literal text, never a pattern. Ignoring case, letters match as Unicode folds them
 * one for one (`σ` finds `Σ` and `ς`), so each match keeps its length in the line and marks the characters it found.
 */
export function findInText(text: string, query: string, options: FindOptions, limit = MAX_MATCHES): FoundMatches {
  if (!query) return NOTHING_FOUND;
  const pattern = matchPattern(query, options);
  const matches: CodeMatch[] = [];
  const lines = text.split(/\r\n|\n|\r/);
  for (let index = 0; index < lines.length; index++) {
    pattern.lastIndex = 0;
    for (let found = pattern.exec(lines[index]!); found; found = pattern.exec(lines[index]!)) {
      if (matches.length === limit) return { matches, capped: true };
      matches.push({ line: index + 1, start: found.index, end: found.index + found[0].length });
    }
  }
  return { matches, capped: false };
}

function matchPattern(query: string, { matchCase, wholeWord }: FindOptions): RegExp {
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = wholeWord ? `(?<![\\p{L}\\p{N}_])${literal}(?![\\p{L}\\p{N}_])` : literal;
  return new RegExp(source, matchCase ? 'gu' : 'giu');
}

/** A place in a side's text: a line, one-based, and a character in it. */
export interface TextPlace {
  line: number;
  character: number;
}

/**
 * The match a search starts at: the first at or after `from` (where the user was: the line clicked, the match shown
 * before the text typed changed), else the first of all, as a search goes round the text. Null with none.
 */
export function firstMatchFrom(matches: readonly CodeMatch[], from: TextPlace | null): number | null {
  if (matches.length === 0) return null;
  if (!from) return 0;
  const after = matches.findIndex((match) => match.line > from.line || (match.line === from.line && match.start >= from.character));
  return after === -1 ? 0 : after;
}

/** The match after `current` (or before it, `backwards`), going round from the last to the first and back. */
export function steppedMatch(count: number, current: number | null, backwards: boolean): number | null {
  if (count === 0) return null;
  if (current === null) return backwards ? count - 1 : 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}

/** What the bar says of the matches: which one shows of how many ("3 of 12"), or that there are none. Nothing before a query. */
export function matchCountWords(query: string, current: number | null, { matches, capped }: FoundMatches): string {
  if (!query) return '';
  if (matches.length === 0) return 'No results';
  const total = `${matches.length.toLocaleString('en-US')}${capped ? '+' : ''}`;
  return current === null ? `${total} results` : `${(current + 1).toLocaleString('en-US')} of ${total}`;
}

/** Each match's characters to mark on its side, the match shown apart, in a stronger color (`useWordMarks`). */
export interface MatchMarks {
  others: WordMarksByLine;
  current: WordMarksByLine;
}

export function matchMarks(side: DiffSide, matches: readonly CodeMatch[], current: number | null): MatchMarks {
  const others = new Map<number, MarkRange[]>();
  const shown = new Map<number, MarkRange[]>();
  matches.forEach(({ line, start, end }, index) => {
    const marks = index === current ? shown : others;
    marks.set(line, [...(marks.get(line) ?? []), { start, end }]);
  });
  return { others: onSide(side, others), current: onSide(side, shown) };
}

function onSide(side: DiffSide, marks: Map<number, MarkRange[]>): WordMarksByLine {
  return side === 'deletions' ? { deletions: marks, additions: new Map() } : { deletions: new Map(), additions: marks };
}

/**
 * The side a search looks in: the one side a diff shows alone (an added file's, a deleted one's), else the side last
 * pressed (a click in the older version searches it), else the newer one.
 */
export function sideToFind(onlySide: DiffSide | null, pressed: DiffSide | null): DiffSide {
  return onlySide ?? pressed ?? 'additions';
}

/** The field's placeholder: which version it searches, where the diff shows two. */
export function findPlaceholder(side: DiffSide, onlySide: DiffSide | null): string {
  if (onlySide) return 'Find';
  return side === 'deletions' ? 'Find in the older version' : 'Find in the newer version';
}

/** A box's extent along one axis, in the page's pixels. */
export interface Extent {
  start: number;
  end: number;
}

/** Whether a match's row needs scrolling to: not drawn yet, or not wholly inside the view top to bottom. */
export function rowNeedsScroll(row: Extent | null, view: Extent): boolean {
  return !row || row.start < view.start || row.end > view.end;
}

/**
 * How far to scroll a pane sideways to show a match's characters: none while they're inside what the pane shows of its
 * code (right of its line numbers), else enough to put them a third of the way across it, as a line goes a third of
 * the way down.
 */
export function sidewaysScrollBy(characters: Extent, shown: Extent): number {
  if (characters.start >= shown.start && characters.end <= shown.end) return 0;
  return characters.start - shown.start - (shown.end - shown.start) / 3;
}
