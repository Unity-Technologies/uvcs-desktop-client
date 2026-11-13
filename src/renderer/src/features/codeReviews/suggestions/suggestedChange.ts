import type { ReviewComment } from '@shared/domain/reviewConversation';
import { suggestionOf } from '@shared/reviewSuggestion';
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

/** A read something waits on: still being read, failed, or its answer. */
export type Read<T> = 'reading' | 'failed' | T;

/**
 * The lines a suggestion replaces, as the revision it was written on has them: read (`string[]`), still being read
 * (`'reading'`), or not to be had (`'unknown'`: the read failed, the file is binary, or shorter than the line).
 */
export type ReplacedLines = string[] | 'reading' | 'unknown';

/** The lines `firstLine` to `lastLine` (1-based) of a version's text, its line ends left out; unknown past its end. */
export function replacedLinesIn(text: string | null | undefined, change: LineRange): ReplacedLines {
  if (text === undefined) return 'reading';
  if (text === null) return 'unknown';
  const lines = text.split(/\r\n|\n|\r/);
  // A text ending in a line end has no line after it (as `withLinesReplaced` counts lines).
  if (lines.at(-1) === '') lines.pop();
  if (change.firstLine < 1 || change.lastLine > lines.length) return 'unknown';
  return lines.slice(change.firstLine - 1, change.lastLine);
}

/** A row of the Suggested change block: a line it removes or adds, or the removed line's place while it's read. */
export type SuggestionRow = { kind: 'removed' | 'added'; text: string } | { kind: 'reading' };

/**
 * The rows the Suggested change block shows: the lines replaced, removed, then those suggested, added, as a diff shows
 * them. While the replaced line is read, one row holds its place, so nothing moves as it arrives; when it can't be
 * read, the suggested lines show alone.
 */
export function suggestionRows(replaced: ReplacedLines, lines: readonly string[]): SuggestionRow[] {
  const removed: SuggestionRow[] =
    replaced === 'reading' ? [{ kind: 'reading' }] : replaced === 'unknown' ? [] : replaced.map((text) => ({ kind: 'removed', text }));
  return [...removed, ...lines.map((text): SuggestionRow => ({ kind: 'added', text }))];
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
