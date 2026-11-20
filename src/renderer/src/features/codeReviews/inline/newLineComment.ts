import type { DiffLineAnnotation } from '@pierre/diffs';
import type { LineCommentKind, NewLineComment } from '@shared/domain/reviewConversation';
import type { ChangedLines, LineBand } from '../../diff/viewer/diffAnnotations';
import { rangeSpan, rangeWordsInline } from '../../../lib/rangeWords';
import { topSideOf } from './fileComments';
import type { ReviewDiffView, ShownFile, ThreadSide } from './fileThreads';
import { lineKey } from './threadRows';

/**
 * A comment being written on lines of a review's diff (`useNewLineCommentsStore`): where it goes, as what, and the
 * side it shows on, under its last line. Kept while the window lives, as its text is (`useCommentDraftStore`), so moving to another file,
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
 * The comment lines of a review's file take (one, or a range selected), or none where `cm` takes none: only the
 * revision the diff comments on (the newer side's, or a deleted file's last one: the side its rows above the code go
 * on, `topSideOf`), so neither the older side of a changed file nor a removed line of a unified diff. Written in one
 * changeset's diff, it's that changeset's (`--changeset`).
 */
export function lineCommentAt(view: ReviewDiffView, file: ShownFile, lines: ChangedLines): Omit<NewLineComment, 'kind'> | null {
  const side = topSideOf(file);
  const revisionId = side === 'additions' ? file.modifiedRevision : file.originalRevision;
  if (lines.side !== side || lines.firstLineNumber < 1 || lines.lineNumber < lines.firstLineNumber || revisionId < 0) return null;
  return { revisionId, firstLine: lines.firstLineNumber, lastLine: lines.lineNumber, ...(view.kind === 'changeset' && { changesetId: view.changesetId }) };
}

/** Names a comment being written: one per line, or range of lines, of a file, in one mode. */
export function newLineCommentKey(reviewId: number, path: string, comment: Omit<NewLineComment, 'kind' | 'revisionId'>): string {
  return [reviewId, comment.changesetId ?? 'whole', path, rangeSpan(comment)].join(':');
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
 * Pierre's rows with those of the comments being written: one under each comment's last line that shows no row yet,
 * after the rest, as rows that come later go (`annotationRowsOf`). A line already showing its threads takes the new
 * comment in its row.
 */
export function withNewLineCommentRows(rows: DiffLineAnnotation<string>[], spots: readonly NewLineCommentSpot[]): DiffLineAnnotation<string>[] {
  const added = spots
    .map((spot): DiffLineAnnotation<string> => ({ side: spot.side, lineNumber: spot.comment.lastLine, metadata: spotRowKey(spot) }))
    .filter((row, index, all) => !rows.some((shown) => shown.metadata === row.metadata) && all.findIndex((other) => other.metadata === row.metadata) === index);
  return added.length === 0 ? rows : [...rows, ...added];
}

/**
 * What a row under a line holds (`withNewLineCommentRows`'s and the threads'): the line's threads when they show (all
 * of them while comments show in the code; opened from their marker while hidden), then the comments being written
 * that end there (on that line, and on a range up to it), in the order they were opened. While hidden, comments
 * written on a line whose threads aren't opened show alone, under their marker.
 */
export function lineRowContent<Line extends { key: string }>(rowKey: string, shownLines: readonly Line[], spots: readonly NewLineCommentSpot[]): { line?: Line; spots: NewLineCommentSpot[] } {
  return {
    line: shownLines.find((line) => line.key === rowKey),
    spots: spots.filter((spot) => spotRowKey(spot) === rowKey),
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

/** The row a comment being written shows in: its last line's, which that line's threads share. */
function spotRowKey(spot: NewLineCommentSpot): string {
  return lineKey(spot.side, spot.comment.lastLine);
}

/** The "+" in the gutter and the code menu's entry: what they do to the lines ("Comment on lines 40–42"). */
export function lineCommentLabel(lines: ChangedLines): string {
  return `Comment on ${rangeWordsInline({ firstLine: lines.firstLineNumber, lastLine: lines.lineNumber })}`;
}

/**
 * The lines' outlines with those being commented on: in the accent, as the card being written is, a line with threads
 * too, so the lines a comment goes on are plain while it's written. A range is outlined from its first line, and so is
 * a line's outline its threads start further down.
 */
export function withNewLineCommentBands(bands: readonly LineBand[], spots: readonly NewLineCommentSpot[]): LineBand[] {
  const firstLines = new Map<string, number>();
  for (const spot of spots) firstLines.set(spotRowKey(spot), Math.min(spot.comment.firstLine, firstLines.get(spotRowKey(spot)) ?? spot.comment.firstLine));
  const marked = bands.map((band) => {
    const firstLine = firstLines.get(band.key);
    return firstLine === undefined ? band : withFirstLine({ ...band, selected: true }, Math.min(firstLine, band.firstLineNumber ?? band.lineNumber));
  });
  const added = [...firstLines]
    .filter(([key]) => !bands.some((shown) => shown.key === key))
    .map(([key, firstLine]): LineBand => {
      const spot = spots.find((candidate) => spotRowKey(candidate) === key)!;
      return withFirstLine({ key, side: spot.side, lineNumber: spot.comment.lastLine, selected: true }, firstLine);
    });
  return [...marked, ...added];
}

/** A band from `firstLine` to its own line: one line has no `firstLineNumber`. */
function withFirstLine(band: LineBand, firstLine: number): LineBand {
  const { firstLineNumber: _, ...line } = band;
  return firstLine < band.lineNumber ? { ...line, firstLineNumber: firstLine } : line;
}

/**
 * What a comment being written does when asked for the focus (`focusRequest`'s `seq`, none when nothing asks), given the
 * request it mounted with: none asked; the one it mounted with, which its field took as it mounted (`taken`); a newer
 * one, its "+" pressed again while it shows, which it takes now (`focus`). A comment kept while its file wasn't shown
 * mounts with none, so showing it again takes nothing from where the user is.
 */
export function focusOnRequest(mountedWith: number | null, request: number | null): 'none' | 'taken' | 'focus' {
  if (request === null) return 'none';
  return request === mountedWith ? 'taken' : 'focus';
}
