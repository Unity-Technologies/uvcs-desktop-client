import type { ReviewComment } from '@shared/domain/reviewConversation';
import { suggestionOf } from '../../../lib/reviewSuggestion';
import { anchorPath } from '../inline/fileThreads';

/** Lines of a file, 1-based as an editor counts them, both included: one line is `firstLine === lastLine`. */
export interface LineRange {
  firstLine: number;
  lastLine: number;
}

/**
 * The lines a comment is on, which its suggestion replaces: the one place a comment's anchor becomes a range. `cm`
 * names one line today (`{line}`, 1-based). Once comments take ranges (`cm codereview comment add --line=A-B`, stored
 * as a `lines:A-B` location, 0-based and inclusive), only this reads them; everything after it takes a range.
 */
export function commentedLines(anchor: { line: number }): LineRange {
  return { firstLine: anchor.line, lastLine: anchor.line };
}

/**
 * What a change request suggests (docs/features/code-reviews.md "Suggested changes"): the lines of a revision of a file
 * it replaces (`LineRange`, from `commentedLines`), and the lines it puts there.
 */
export interface SuggestedChange extends LineRange {
  /** A repository path without its leading slash, as the diff names files (`anchorPath`). */
  path: string;
  revisionId: number;
  /** What takes their place: none deletes them. */
  lines: string[];
}

/**
 * The change a comment suggests, or none: only a change request on a line holds one, as only those can be applied
 * (`[apply-change:…]`). A suggestion fence in a question or a comment is a code block like any other.
 */
export function suggestedChangeOf(comment: Pick<ReviewComment, 'kind' | 'anchor' | 'text'>): SuggestedChange | null {
  if (comment.kind !== 'changeRequest' || comment.anchor.kind !== 'line') return null;
  const suggestion = suggestionOf(comment.text);
  if (!suggestion) return null;
  const { anchor } = comment;
  return { path: anchorPath(anchor), revisionId: anchor.revisionId, ...commentedLines(anchor), lines: suggestion.lines };
}

/**
 * Something the window reads, as what waits on it sees it: still being read, failed, or read (`value`). Tagged, so a
 * value never reads as one of the others (a file whose text is "failed").
 */
export type Read<T> = { kind: 'reading' } | { kind: 'failed' } | { kind: 'read'; value: T };

export const READING: Read<never> = { kind: 'reading' };
export const FAILED: Read<never> = { kind: 'failed' };

export function readValue<T>(value: T): Read<T> {
  return { kind: 'read', value };
}

/**
 * The lines a suggestion replaces, as the revision it was written on has them; failed when they're not to be had (the
 * read failed, the version has no text, or is shorter than the lines).
 */
export type ReplacedLines = Read<string[]>;

/**
 * The lines `firstLine` to `lastLine` (1-based) of a version's text (`null`: a version with no text, binary or too
 * large), their line ends left out.
 */
export function replacedLinesIn(text: Read<string | null>, change: LineRange): ReplacedLines {
  if (text.kind !== 'read') return text;
  if (text.value === null) return FAILED;
  const lines = text.value.split(/\r\n|\n|\r/);
  // A text ending in a line end has no line after it (as `withLinesReplaced` counts lines).
  if (lines.at(-1) === '') lines.pop();
  if (change.firstLine < 1 || change.lastLine > lines.length) return FAILED;
  return readValue(lines.slice(change.firstLine - 1, change.lastLine));
}

/**
 * What the Suggested change box shows under its header: the diff of the lines replaced to those suggested, each text
 * as a file holding the lines (each ending in a line end, so no side reads as missing its last one), which Pierre lays
 * out as the code's diff (`suggestionFileDiff`). While the replaced lines are read, a place as tall as their rows, so nothing
 * moves as they arrive; when they can't be read, the suggested lines alone, added, and for a deletion nothing.
 * `rowCount` is the rows the diff takes at most (a line kept shows once), for the place it holds while Pierre loads.
 */
export type SuggestionBody =
  | { kind: 'reading'; rowCount: number }
  | { kind: 'diff'; replacedText: string; suggestedText: string; rowCount: number }
  | { kind: 'empty' };

export function suggestionBody(change: LineRange & Pick<SuggestedChange, 'lines'>, replaced: ReplacedLines): SuggestionBody {
  if (replaced.kind === 'reading') return { kind: 'reading', rowCount: change.lastLine - change.firstLine + 1 + change.lines.length };
  const replacedLines = replaced.kind === 'read' ? replaced.value : [];
  if (replacedLines.length === 0 && change.lines.length === 0) return { kind: 'empty' };
  return { kind: 'diff', replacedText: asFile(replacedLines), suggestedText: asFile(change.lines), rowCount: replacedLines.length + change.lines.length };
}

function asFile(lines: readonly string[]): string {
  return lines.map((line) => `${line}\n`).join('');
}

/** The block's heading: what it does to the code. */
export function suggestionTitle(change: LineRange & Pick<SuggestedChange, 'lines'>): string {
  if (change.lines.length > 0) return 'Suggested change';
  return change.lastLine > change.firstLine ? 'Suggested change: delete the lines' : 'Suggested change: delete the line';
}

/** "Line 13", "Lines 13–15": the lines a suggestion replaces, as its reasons name them. */
export function rangeWords({ firstLine, lastLine }: LineRange): string {
  return lastLine > firstLine ? `Lines ${firstLine}–${lastLine}` : `Line ${firstLine}`;
}
