import type { ImageSpot, LineCommentKind, ModelSpot } from '@shared/domain/reviewConversation';
import { topSideOf } from './fileComments';
import type { ReviewDiffView, ShownFile, ThreadSide } from './fileThreads';
import { DEFAULT_LINE_COMMENT_KIND } from './newLineComment';

/** A comment being written on a spot of a review's diff (a point or an area of an image, a point or a part of a model). */
export interface NewSpotComment<Spot> {
  /** Names it among the review's, its pin, and its draft: made with a serial, never from its spot, which moves. */
  key: string;
  reviewId: number;
  /** The file's, as the diff names it: what finds it again once the file's newest revision changed. */
  path: string;
  side: ThreadSide;
  comment: { revisionId: number; spot: Spot; kind: LineCommentKind; changesetId?: number };
}

/** A comment being written on a point or an area of an image of a review's diff. */
export type NewImageCommentSpot = NewSpotComment<ImageSpot>;

/** A comment being written on a point or a part of a 3D model of a review's diff. */
export type NewModelCommentSpot = NewSpotComment<ModelSpot>;

/** Where a spot's comment goes: the revision, the spot, and the changeset whose diff it's written in. */
export type SpotCommentAt<Spot> = Omit<NewSpotComment<Spot>['comment'], 'kind'>;

/**
 * The comment a spot of a review's image or model takes: on the revision the diff comments on, as lines do
 * (`lineCommentAt`): the newer side's, or a deleted file's last one. Written in one changeset's diff, it's that
 * changeset's. None for a file with no such revision.
 */
export function spotCommentAt<Spot>(view: ReviewDiffView, file: ShownFile, spot: Spot): SpotCommentAt<Spot> | null {
  const revisionId = commentedRevisionOf(file);
  if (revisionId < 0) return null;
  return { revisionId, spot, ...(view.kind === 'changeset' && { changesetId: view.changesetId }) };
}

/** The side of a diff that takes comments on spots (`spotCommentAt`); none for a file with no revision to comment on. */
export function spotCommentSide(file: ShownFile): ThreadSide | null {
  return commentedRevisionOf(file) < 0 ? null : topSideOf(file);
}

function commentedRevisionOf(file: ShownFile): number {
  return topSideOf(file) === 'additions' ? file.modifiedRevision : file.originalRevision;
}

/**
 * A comment started on a spot of an image or a model (`on`): a change request, as on lines
 * (`DEFAULT_LINE_COMMENT_KIND`). Named by the `serial` the window gave it, not by its spot, which moves while it's
 * written.
 */
export function newSpotComment<Spot>(on: 'image' | 'model', reviewId: number, path: string, side: ThreadSide, at: SpotCommentAt<Spot>, serial: number): NewSpotComment<Spot> {
  return { key: `${reviewId}:${path}:${on}:${serial}`, reviewId, path, side, comment: { ...at, kind: DEFAULT_LINE_COMMENT_KIND } };
}

/**
 * The comments being written on the file shown: the review's, on the file, in the mode it's in, each on the revision
 * and side the file shows now, as `newLineCommentsIn` keeps those on lines: a spot stays where it was marked as the
 * branch's newest revision changes.
 */
export function newSpotCommentsIn<Draft extends NewSpotComment<unknown>>(spots: readonly Draft[], reviewId: number, view: ReviewDiffView, file: ShownFile): Draft[] {
  const changesetId = view.kind === 'changeset' ? view.changesetId : undefined;
  const side = topSideOf(file);
  const revisionId = commentedRevisionOf(file);
  return spots
    .filter((spot) => spot.reviewId === reviewId && spot.path === file.path && spot.comment.changesetId === changesetId)
    .map((spot) => (spot.comment.revisionId === revisionId && spot.side === side ? spot : { ...spot, side, comment: { ...spot.comment, revisionId } }));
}
