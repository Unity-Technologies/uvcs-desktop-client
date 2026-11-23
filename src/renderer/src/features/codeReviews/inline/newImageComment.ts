import type { ImageSpot, NewImageComment } from '@shared/domain/reviewConversation';
import { topSideOf } from './fileComments';
import type { ReviewDiffView, ShownFile, ThreadSide } from './fileThreads';
import { DEFAULT_LINE_COMMENT_KIND } from './newLineComment';

/** A comment being written on a point or an area of an image of a review's diff: where it goes and what it is so far. */
export interface NewImageCommentSpot {
  /** Names it among the review's (`newImageCommentSpot`), its pin, and its draft. */
  key: string;
  reviewId: number;
  /** The file's, as the diff names it: what finds it again once the file's newest revision changed. */
  path: string;
  side: ThreadSide;
  comment: NewImageComment;
}

/**
 * The comment a spot of a review's image takes: on the revision the diff comments on, as lines do (`lineCommentAt`):
 * the newer side's, or a deleted image's last one. Written in one changeset's diff, it's that changeset's. None for a
 * file with no such revision.
 */
export function imageCommentAt(view: ReviewDiffView, file: ShownFile, spot: ImageSpot): Omit<NewImageComment, 'kind'> | null {
  const revisionId = commentedRevisionOf(file);
  if (revisionId < 0) return null;
  return { revisionId, spot, ...(view.kind === 'changeset' && { changesetId: view.changesetId }) };
}

/** The side of an image's diff that takes comments (`imageCommentAt`); none for a file with no revision to comment on. */
export function imageCommentSide(file: ShownFile): ThreadSide | null {
  return commentedRevisionOf(file) < 0 ? null : topSideOf(file);
}

function commentedRevisionOf(file: ShownFile): number {
  return topSideOf(file) === 'additions' ? file.modifiedRevision : file.originalRevision;
}

/** A comment started on a spot of an image: a change request, as on lines (`DEFAULT_LINE_COMMENT_KIND`). */
export function newImageCommentSpot(reviewId: number, path: string, side: ThreadSide, at: Omit<NewImageComment, 'kind'>): NewImageCommentSpot {
  const { x, y, size } = at.spot;
  const where = size ? `${x},${y},${size.width},${size.height}` : `${x},${y}`;
  return { key: `${reviewId}:${at.changesetId ?? ''}:${path}:image:${where}`, reviewId, path, side, comment: { ...at, kind: DEFAULT_LINE_COMMENT_KIND } };
}

/**
 * The comments being written on the image shown: the review's, on the file, in the mode it's in, each on the revision
 * and side the file shows now, as `newLineCommentsIn` keeps those on lines: a spot stays where it was marked as the
 * branch's newest revision changes.
 */
export function newImageCommentsIn(spots: readonly NewImageCommentSpot[], reviewId: number, view: ReviewDiffView, file: ShownFile): NewImageCommentSpot[] {
  const changesetId = view.kind === 'changeset' ? view.changesetId : undefined;
  const side = topSideOf(file);
  const revisionId = commentedRevisionOf(file);
  return spots
    .filter((spot) => spot.reviewId === reviewId && spot.path === file.path && spot.comment.changesetId === changesetId)
    .map((spot) => (spot.comment.revisionId === revisionId && spot.side === side ? spot : { ...spot, side, comment: { ...spot.comment, revisionId } }));
}
