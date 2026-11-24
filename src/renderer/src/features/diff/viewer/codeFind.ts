import { matchesShortcut, type PressedKey } from '../../../lib/shortcuts';
import { isMac } from '../../../lib/platform';
import { SHORTCUTS, shortcutKeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import type { ChangedLine, DiffSide } from './changeBlocks';
import type { MarkRange, WordMarksByLine } from './wordMarkRows';

/**
 * Finding text in a diff, on either side (`useCodeFind`, `CodeFindBar`), and replacing it in the side typed into. The
 * app's own search everywhere: Pierre's editor has a search panel of its own, but only over the text typed into, so the
 * keys that would open it open this one instead (`searchKeyMode`).
 */

/** How the text typed is matched. */
export interface FindOptions {
  matchCase: boolean;
  /** Only where the text stands as a word of its own: no letter, digit or underscore just before or after it. */
  wholeWord: boolean;
  /** The text is a regular expression (JavaScript's, Unicode-aware). */
  regex: boolean;
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
 * Pierre breaks the lines it shows), in the order of the text. The text literally, unless `regex`: then a pattern, one
 * that doesn't compile (a `(` typed on the way to `(a|b)`) finding nothing, and an empty match (`^`, `a*`) skipped, as
 * there's nothing to mark. Ignoring case, letters match as Unicode folds them one for one (`σ` finds `Σ` and `ς`), so
 * each match keeps its length in the line and marks the characters it found. Past `limit`, the matches kept are those
 * from `fromLine` on, going round from the top: the ones around where the user searches from, never only the file's
 * first.
 */
export function findInText(text: string, query: string, options: FindOptions, limit = MAX_MATCHES, fromLine = 1): FoundMatches {
  if (!query) return NOTHING_FOUND;
  const pattern = matchPattern(query, options);
  if (!pattern) return NOTHING_FOUND;
  const lines = text.split(/\r\n|\n|\r/);
  const first = Math.min(Math.max(fromLine, 1), lines.length) - 1;
  const after: CodeMatch[] = [];
  const before: CodeMatch[] = [];
  for (let step = 0; step < lines.length; step++) {
    const index = (first + step) % lines.length;
    const kept = index >= first ? after : before;
    pattern.lastIndex = 0;
    for (let found = pattern.exec(lines[index]!); found; found = pattern.exec(lines[index]!)) {
      if (found[0].length === 0) {
        pattern.lastIndex++;
        continue;
      }
      if (after.length + before.length === limit) return { matches: [...before, ...after], capped: true };
      kept.push({ line: index + 1, start: found.index, end: found.index + found[0].length });
    }
  }
  return { matches: [...before, ...after], capped: false };
}

/** The pattern a search runs, line by line; null for a regular expression that doesn't compile. */
function matchPattern(query: string, { matchCase, wholeWord, regex }: FindOptions, mode: 'g' | 'y' = 'g'): RegExp | null {
  const text = regex ? `(?:${query})` : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = wholeWord ? `(?<![\\p{L}\\p{N}_])${text}(?![\\p{L}\\p{N}_])` : text;
  try {
    return new RegExp(source, `${mode}u${matchCase ? '' : 'i'}`);
  } catch {
    return null;
  }
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

/** What the bar says of the matches: which one shows of how many ("3 of 12"), or that there are none, a query typed or not yet. */
export function matchCountWords(current: number | null, { matches, capped }: FoundMatches): string {
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

/** Find alone, or Find and replace (the side typed into only: `canReplace`). */
export type FindMode = 'find' | 'replace';

/** Where Find opens: the side it searches, and where from (the line pressed there; none pressed there: the top). */
export interface FindOpening {
  side: DiffSide;
  from: TextPlace | null;
}

/**
 * Where ⌘F, or Find in the code's menu, opens: on `on` (the side right-clicked), else on the side last pressed
 * (`sideToFind`), from the line pressed when it was pressed on that side.
 */
export function findOpening(onlySide: DiffSide | null, pressed: ChangedLine | null, on?: DiffSide): FindOpening {
  const side = sideToFind(onlySide, on ?? pressed?.side ?? null);
  return { side, from: pressed?.side === side ? { line: pressed.lineNumber, character: 0 } : null };
}

/** Whether the search over `side` replaces too: only in the text typed into, the newer side. */
export function canReplace(side: DiffSide, typedInto: boolean): boolean {
  return typedInto && side === 'additions';
}

/** What a key does in one of the bar's fields. */
export type FindBarKeyAction = 'close' | 'next' | 'previous' | 'reselect' | 'showReplace' | 'replaceOne';

/** The bar's fields: the text searched for, and what replaces it. */
export type FindBarField = 'search' | 'replace';

/**
 * The bar's keys (the registry's "Text" area): Esc closes it, Enter and Shift+Enter step to the next and previous
 * match (in the replace field, Enter replaces the match shown, as Pierre's panel does), ⌘F selects the text searched
 * for again and Replace's key (⌥⌘F, Ctrl+H) shows the replace field. The bar takes them before anything else, so ⌘F
 * never reaches the view's filter of files (`FilterField` listens on the window). None for any other key, which the
 * field types.
 */
export function findBarKeyAction(event: PressedKey, field: FindBarField = 'search', mac?: boolean): FindBarKeyAction | null {
  if (pressedShortcut(event, 'textCloseFind', mac)) return 'close';
  if (pressedShortcut(event, 'textReplace', mac)) return 'showReplace';
  if (pressedShortcut(event, 'textFindPrevious', mac)) return 'previous';
  if (pressedShortcut(event, 'textFindNext', mac)) return field === 'replace' ? 'replaceOne' : 'next';
  if (pressedShortcut(event, 'textFind', mac)) return 'reselect';
  return null;
}

/** Whether `event` is one of a shortcut's keys on the platform (`mac`: the app's own by default). */
function pressedShortcut(event: PressedKey, id: ShortcutId, mac = isMac): boolean {
  return shortcutKeys(SHORTCUTS[id], mac).some((key) => matchesShortcut(event, key, mac));
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

/** How far in from the right edge of the side searched the bar stands, in pixels. */
export const FIND_BAR_INSET = 16;

/**
 * Where the bar stands, as pixels from the right edge of the diff's frame: at the top right of the pane of the side it
 * searches, as the search box of each side of a diff in the desktop client did. Null where that side has no pane of its own (a unified diff, one side shown alone): then at the
 * diff's top right.
 */
export function findBarRight(pane: Extent | null, frame: Extent): number | null {
  return pane ? Math.max(frame.end - pane.end, 0) + FIND_BAR_INSET : null;
}

/** A change to the text typed into, as Pierre's editor takes it (`TextEdit`): zero-based lines, UTF-16 characters. */
export interface CodeEdit {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  newText: string;
}

/**
 * The edits that replace `matches` in `text` with `replacement`. The text typed literally, unless `regex`: then `$1`,
 * `$&` and `$<name>` stand for what the match captured, as JavaScript's `replace` reads them, each match read where it
 * stands in its line (a whole word's edges, a lookbehind).
 */
export function replaceEdits(text: string, matches: readonly CodeMatch[], query: string, options: FindOptions, replacement: string): CodeEdit[] {
  const lines = text.split(/\r\n|\n|\r/);
  const pattern = options.regex ? matchPattern(query, options, 'y') : null;
  return matches.map((match) => {
    const line = lines[match.line - 1] ?? '';
    const range = { start: { line: match.line - 1, character: match.start }, end: { line: match.line - 1, character: match.end } };
    return { range, newText: pattern ? expandedReplacement(line, match, pattern, replacement) : replacement };
  });
}

/** What a regular expression's match becomes: the line with that match replaced, by `replace` with the pattern sticky at its start, cut back to the match. */
function expandedReplacement(line: string, match: CodeMatch, pattern: RegExp, replacement: string): string {
  pattern.lastIndex = match.start;
  const replaced = line.replace(pattern, replacement);
  return replaced.slice(match.start, replaced.length - (line.length - match.end));
}

/** Where a search goes on from after a replace: just past the text put in, so it never finds what it just wrote. */
export function placeAfterReplace(edit: CodeEdit): TextPlace {
  const written = edit.newText.split(/\r\n|\n|\r/);
  const line = edit.range.start.line + written.length;
  const character = (written.length === 1 ? edit.range.start.character : 0) + written.at(-1)!.length;
  return { line, character };
}
