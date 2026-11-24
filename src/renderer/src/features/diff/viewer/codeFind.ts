import { matchesShortcut, type PressedKey } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ChangedLine, DiffSide } from './changeBlocks';
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
 * Pierre breaks the lines it shows), in the order of the text. Literal text, never a pattern. Ignoring case, letters
 * match as Unicode folds them one for one (`σ` finds `Σ` and `ς`), so each match keeps its length in the line and marks
 * the characters it found. Past `limit`, the matches kept are those from `fromLine` on, going round from the top: the
 * ones around where the user searches from, never only the file's first.
 */
export function findInText(text: string, query: string, options: FindOptions, limit = MAX_MATCHES, fromLine = 1): FoundMatches {
  if (!query) return NOTHING_FOUND;
  const pattern = matchPattern(query, options);
  const lines = text.split(/\r\n|\n|\r/);
  const first = Math.min(Math.max(fromLine, 1), lines.length) - 1;
  const after: CodeMatch[] = [];
  const before: CodeMatch[] = [];
  for (let step = 0; step < lines.length; step++) {
    const index = (first + step) % lines.length;
    const kept = index >= first ? after : before;
    pattern.lastIndex = 0;
    for (let found = pattern.exec(lines[index]!); found; found = pattern.exec(lines[index]!)) {
      if (after.length + before.length === limit) return { matches: [...before, ...after], capped: true };
      kept.push({ line: index + 1, start: found.index, end: found.index + found[0].length });
    }
  }
  return { matches: [...before, ...after], capped: false };
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
  if (matches.length === 0 || current === null) return 'No results';
  return `${(current + 1).toLocaleString('en-US')} of ${matches.length.toLocaleString('en-US')}${capped ? '+' : ''}`;
}

/**
 * Every match's characters to mark on its side (`useWordMarks`), by line. Made once per search, not per step: the match
 * shown is marked on its own over them, in a stronger color (`shownMatchMarks`).
 */
export function matchMarks(side: DiffSide, matches: readonly CodeMatch[]): WordMarksByLine {
  const marks = new Map<number, MarkRange[]>();
  for (const { line, start, end } of matches) {
    const lineMarks = marks.get(line);
    if (lineMarks) lineMarks.push({ start, end });
    else marks.set(line, [{ start, end }]);
  }
  return onSide(side, marks);
}

/** The match shown's characters, marked over every match's. */
export function shownMatchMarks(side: DiffSide, match: CodeMatch | null): WordMarksByLine {
  return onSide(side, new Map(match ? [[match.line, [{ start: match.start, end: match.end }]]] : []));
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

/** Where Find opens and what it searches from. */
export type FindOpening =
  /** The side is typed into: Pierre's own search panel, which its editor has (`openPierreSearchPanel`). */
  | { kind: 'editor' }
  /** The app's bar, on a read-only side, from the line pressed there (none pressed there: from the top). */
  | { kind: 'bar'; side: DiffSide; from: TextPlace | null };

/**
 * Where ⌘F, or Find in the code's menu, opens: on `on` (the side right-clicked), else on the side last pressed
 * (`sideToFind`). The newer side, typed into, has Pierre's search panel, so one side never has two searches; any other
 * side has the bar, from the line pressed when it was pressed on that side.
 */
export function findOpening(onlySide: DiffSide | null, typedInto: boolean, pressed: ChangedLine | null, on?: DiffSide): FindOpening {
  const side = sideToFind(onlySide, on ?? pressed?.side ?? null);
  if (typedInto && side === 'additions') return { kind: 'editor' };
  return { kind: 'bar', side, from: pressed?.side === side ? { line: pressed.lineNumber, character: 0 } : null };
}

/** What a key does in the bar's field. */
export type FindBarKeyAction = 'close' | 'next' | 'previous' | 'reselect';

/**
 * The bar's keys (the registry's "Text" area): Esc closes it, Enter and Shift+Enter step to the next and previous
 * match, and ⌘F selects its text again. The bar takes them before anything else, so ⌘F never reaches the view's filter
 * of files (`FilterField` listens on the window). None for any other key, which the field types.
 */
export function findBarKeyAction(event: PressedKey, mac?: boolean): FindBarKeyAction | null {
  if (matchesShortcut(event, hotkey('textCloseFind'), mac)) return 'close';
  if (matchesShortcut(event, hotkey('textFindPrevious'), mac)) return 'previous';
  if (matchesShortcut(event, hotkey('textFindNext'), mac)) return 'next';
  if (matchesShortcut(event, hotkey('textFind'), mac)) return 'reselect';
  return null;
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
