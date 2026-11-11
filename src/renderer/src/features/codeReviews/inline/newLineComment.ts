import type { DiffLineAnnotation } from '@pierre/diffs';
import type { LineCommentKind, NewLineComment } from '@shared/domain/reviewConversation';
import type { ChangedLine } from '../../diff/viewer/changeBlocks';
import type { LineBand } from '../../diff/viewer/diffAnnotations';
import { topSideOf } from './fileComments';
import type { ReviewDiffView, ShownFile, ThreadSide } from './fileThreads';
import { lineKey } from './threadRows';

/**
 * A comment being written on a line of a review's diff (`useNewLineCommentsStore`): where it goes, as what, and the
 * line it shows under. Kept while the window lives, as its text is (`useCommentDraftStore`), so moving to another file,
 * tab or mode and back finds it where it was: nothing asks to save it on the way.
 */
export interface NewLineCommentSpot {
  /** Names it among the review's (`newLineCommentKey`), and its draft. */
  key: string;
  reviewId: number;
  /** The file's, as the diff names it: what finds it again once the file's newest revision changed. */
  path: string;
  side: ThreadSide;
  comment: NewLineComment;
}

/** What a new comment on a line starts as: a change request, the kind a reviewer writes most, as the official client does. */
export const DEFAULT_LINE_COMMENT_KIND: LineCommentKind = 'changeRequest';

/** The kinds a new comment on a line is offered as, in the order its switch shows them: the default first. */
export const LINE_COMMENT_KINDS: readonly LineCommentKind[] = ['changeRequest', 'question', 'comment'];

/**
 * The comment a line of a review's file takes, or none where `cm` takes none: only the revision the diff comments on
 * (the newer side's, or a deleted file's last one: the side its rows above the code go on, `topSideOf`), so neither the
 * older side of a changed file nor a removed line of a unified diff. Written changeset by changeset, it's that
 * changeset's (`--changeset`).
 */
export function lineCommentAt(view: ReviewDiffView, file: ShownFile, line: ChangedLine): Omit<NewLineComment, 'kind'> | null {
  const side = topSideOf(file);
  const revisionId = side === 'additions' ? file.modifiedRevision : file.originalRevision;
  if (line.side !== side || line.lineNumber < 1 || revisionId < 0) return null;
  return { revisionId, line: line.lineNumber, ...(view.kind === 'changeset' && { changesetId: view.changesetId }) };
}

/** Names a comment being written: one per line of a file, in one mode. */
export function newLineCommentKey(reviewId: number, path: string, comment: Omit<NewLineComment, 'kind' | 'revisionId'>): string {
  return [reviewId, comment.changesetId ?? 'whole', path, comment.line].join(':');
}

/** A new comment on a line of a file of a review, in a mode, the line's own kind of comment (`lineCommentAt`). */
export function newLineCommentSpot(reviewId: number, path: string, side: ThreadSide, at: Omit<NewLineComment, 'kind'>): NewLineCommentSpot {
  return { key: newLineCommentKey(reviewId, path, at), reviewId, path, side, comment: { ...at, kind: DEFAULT_LINE_COMMENT_KIND } };
}

/**
 * The comments being written in the diff shown: the review's, on the file, in the mode it's in, each on the revision and
 * side the file shows now. A branch's newest revision changes as its author checks in, and the reviews read again: the
 * comment stays at its line number (the code there may have changed: it's the reviewer's to see) and goes on the
 * revision now shown, on the side `cm` comments on (a file deleted since has only its last revision), never on one the
 * diff no longer shows, where it would read outdated at once. A file moved since, or now shorter than the line, shows it
 * no more: its text stays kept, and the comment shows again if the file comes back to it.
 */
export function newLineCommentsIn(spots: readonly NewLineCommentSpot[], reviewId: number, view: ReviewDiffView, file: ShownFile): NewLineCommentSpot[] {
  const changesetId = view.kind === 'changeset' ? view.changesetId : undefined;
  const side = topSideOf(file);
  const revisionId = side === 'additions' ? file.modifiedRevision : file.originalRevision;
  return spots
    .filter((spot) => spot.reviewId === reviewId && spot.path === file.path && spot.comment.changesetId === changesetId)
    .map((spot) => (spot.comment.revisionId === revisionId && spot.side === side ? spot : { ...spot, side, comment: { ...spot.comment, revisionId } }));
}

/**
 * Pierre's rows with those of the comments being written: one under each line that shows no row yet, after the rest,
 * as rows that come later go (`annotationRowsOf`). A line already showing its threads takes the new comment in its row.
 */
export function withNewLineCommentRows(rows: DiffLineAnnotation<string>[], spots: readonly NewLineCommentSpot[]): DiffLineAnnotation<string>[] {
  const added = spots
    .map((spot): DiffLineAnnotation<string> => ({ side: spot.side, lineNumber: spot.comment.line, metadata: lineKey(spot.side, spot.comment.line) }))
    .filter((row) => !rows.some((shown) => shown.metadata === row.metadata));
  return added.length === 0 ? rows : [...rows, ...added];
}

/**
 * What a row under a line holds (`withNewLineCommentRows`'s and the threads'): the line's threads when they show (all
 * of them while comments show in the code; opened from their marker while hidden), then the comment being written
 * there, if any. While hidden, a comment written on a line whose threads aren't opened shows alone, under their marker.
 */
export function lineRowContent<Line extends { key: string }>(rowKey: string, shownLines: readonly Line[], spots: readonly NewLineCommentSpot[]): { line?: Line; spot?: NewLineCommentSpot } {
  return {
    line: shownLines.find((line) => line.key === rowKey),
    spot: spots.find((spot) => lineKey(spot.side, spot.comment.line) === rowKey),
  };
}

/** What the composer of a new comment says for each kind: its placeholder, and its button's verb. */
export function lineCommentWords(kind: LineCommentKind): { placeholder: string; submit: string } {
  return LINE_COMMENT_WORDS[kind];
}

const LINE_COMMENT_WORDS: Record<LineCommentKind, { placeholder: string; submit: string }> = {
  changeRequest: { placeholder: 'What should change?', submit: 'Request change' },
  question: { placeholder: 'What would you like to know?', submit: 'Ask question' },
  comment: { placeholder: 'Leave a comment', submit: 'Comment' },
};

/** The "+" in the gutter and the code menu's entry: what they do to the line. */
export function lineCommentLabel(line: ChangedLine): string {
  return `Comment on line ${line.lineNumber}`;
}

/**
 * The lines' outlines with those being commented on: in the accent, as the card being written is, a line with threads
 * too, so the line a comment goes on is plain while it's written.
 */
export function withNewLineCommentBands(bands: readonly LineBand[], spots: readonly NewLineCommentSpot[]): LineBand[] {
  const commented = new Set(spots.map((spot) => lineKey(spot.side, spot.comment.line)));
  const marked = bands.map((band) => (commented.has(band.key) ? { ...band, selected: true } : band));
  const added = spots
    .map((spot): LineBand => ({ key: lineKey(spot.side, spot.comment.line), side: spot.side, lineNumber: spot.comment.line, selected: true }))
    .filter((band) => !bands.some((shown) => shown.key === band.key));
  return [...marked, ...added];
}
