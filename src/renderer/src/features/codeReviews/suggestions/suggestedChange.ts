import type { ReviewComment } from '@shared/domain/reviewConversation';
import { suggestionOf } from '@shared/reviewSuggestion';
import { anchorPath } from '../inline/fileThreads';

/**
 * What a change request suggests (docs/features/code-reviews.md "Suggested changes"): the lines of a revision of a file
 * it replaces, and the lines it puts there. `cm` names one line today, so `firstLine` and `lastLine` are the same; a
 * comment on a range (a future `--line=A-B`) fills both.
 */
export interface SuggestedChange {
  /** A repository path without its leading slash, as the diff names files (`anchorPath`). */
  path: string;
  revisionId: number;
  firstLine: number;
  lastLine: number;
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
  return { path: anchorPath(anchor), revisionId: anchor.revisionId, firstLine: anchor.line, lastLine: anchor.line, lines: suggestion.lines };
}

/** A read something waits on: still being read, failed, or its answer. */
export type Read<T> = 'reading' | 'failed' | T;

/**
 * The lines a suggestion replaces, as the revision it was written on has them: read (`string[]`), still being read
 * (`'reading'`), or not to be had (`'unknown'`: the read failed, the file is binary, or shorter than the line).
 */
export type ReplacedLines = string[] | 'reading' | 'unknown';

/** The lines `firstLine` to `lastLine` (1-based) of a version's text, its line ends left out; unknown past its end. */
export function replacedLinesIn(text: string | null | undefined, change: Pick<SuggestedChange, 'firstLine' | 'lastLine'>): ReplacedLines {
  if (text === undefined) return 'reading';
  if (text === null) return 'unknown';
  const lines = text.split(/\r\n|\n|\r/);
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
export function suggestionTitle(lines: readonly string[]): string {
  return lines.length === 0 ? 'Suggested change: delete the line' : 'Suggested change';
}
