import type { CodeReviewStatus, MergeRequestState } from './codeReview';

/**
 * What a review comment is, as the server types it:
 * - `general`: on the whole review, the conversation's own comments;
 * - `comment`, `changeRequest`, `question`: on a file's line. A change request stays open until a changeset applies it
 *   or someone discards it; a question until someone answers it. A reply is a `comment`;
 * - `discard`: the reply that discards a change request, saying why.
 */
export type ReviewCommentKind = 'general' | 'comment' | 'changeRequest' | 'question' | 'discard';

/** Lines of a file, 1-based as an editor counts them, both included: one line is `firstLine === lastLine`. */
export interface LineRange {
  firstLine: number;
  lastLine: number;
}

/** An image's size, in its own pixels. */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Where on an image a comment is, in the image's own pixels from its top-left corner (x to the right, y down): a point,
 * or, with a `size`, the area that runs from it.
 */
export interface ImageSpot {
  x: number;
  y: number;
  size?: ImageSize;
}

/** A point in a 3D model's file, in its own units and axes: before any import scale or axis turn a viewer applies. */
export interface ModelPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Where on a 3D model a comment is: a point on its surface, in the file's own space, so every client places it alike
 * from the file. The rest are hints a reader may go without:
 * - `node`: the part the point is on, by the names from the file's root down to it, and the point in that part's own
 *   space (`local`), which places it on the part wherever the part is now: on another version, or while a take moves it;
 * - `wholePart`: the comment is about that whole part, not the point (only with a `node`);
 * - `view`: where the camera was when it was written, as a direction from the point and a distance, in the file's space.
 */
export interface ModelSpot {
  point: ModelPoint;
  node?: ModelSpotNode;
  wholePart?: true;
  view?: ModelSpotView;
}

/** The part of a model a spot is on: its names from the root, and the point in its own space when known. */
export interface ModelSpotNode {
  path: string[];
  local?: ModelPoint;
}

/** The camera a spot was written from: the direction from the point to it, and how far it was, in the file's space. */
export interface ModelSpotView {
  direction: ModelPoint;
  distance: number;
}

/** The revision of a file a comment is on, by the item and the path it had there. */
export interface CommentedRevision {
  revisionId: number;
  itemId: number;
  path: string;
}

/**
 * Where a comment is: the whole review, or one revision of a file: its lines (one line, or a range of them), a spot
 * of the image it is, or a spot of the 3D model it is.
 */
export type ReviewCommentAnchor =
  | { kind: 'review' }
  | ({ kind: 'line' } & CommentedRevision & LineRange)
  | ({ kind: 'image'; spot: ImageSpot } & CommentedRevision)
  | ({ kind: 'model'; spot: ModelSpot } & CommentedRevision);

/** An anchor on a file: its lines, a spot of its image, or a spot of its 3D model. */
export type FileAnchor = Exclude<ReviewCommentAnchor, { kind: 'review' }>;

export interface ReviewComment {
  id: number;
  /** What `cm codereview comment` names it by. */
  guid: string;
  author: string;
  date: string;
  /** When its text was last edited; none when it never was. */
  editedDate?: string;
  text: string;
  kind: ReviewCommentKind;
  /** The comment it replies to; none for a thread's first comment. */
  parentId?: number;
  anchor: ReviewCommentAnchor;
  /** The changeset whose diff it was written in, one picked in a branch's list; none for the whole branch's diff. */
  changesetId?: number;
  /** The changeset that applied a change request. */
  appliedInChangeset?: number;
}

/**
 * The kinds a comment on a file (its lines, a spot of its image) is written as: the reviewer picks one, and it can't
 * change once posted.
 */
export type LineCommentKind = Extract<ReviewCommentKind, 'changeRequest' | 'question' | 'comment'>;

/**
 * Where a new comment on lines goes, and as what: lines of the revision the review's diff shows (the newer side's, or a
 * deleted file's last one), and the changeset whose diff it's written in, when one is.
 */
export interface NewLineComment extends LineRange {
  revisionId: number;
  kind: LineCommentKind;
  changesetId?: number;
}

/** Where a new comment on an image goes, and as what: a spot of the revision the review's diff shows, as for lines. */
export interface NewImageComment {
  revisionId: number;
  spot: ImageSpot;
  kind: LineCommentKind;
  changesetId?: number;
}

/** Where a new comment on a 3D model goes, and as what: a spot of the revision the review's diff shows, as for lines. */
export interface NewModelComment {
  revisionId: number;
  spot: ModelSpot;
  kind: LineCommentKind;
  changesetId?: number;
}

/** What the server notes on its own as a review goes (a status, a rename, the reviewers asked), by whom and when. */
export type ReviewEvent = { id: number; author: string; date: string } & ReviewEventChange;

export type ReviewEventChange =
  | { kind: 'reviewRequested'; reviewers: string[] }
  | { kind: 'reviewRequestedAgain'; reviewer: string }
  | { kind: 'reviewerRemoved'; reviewer: string }
  /** A reviewer's own status, with what they said about it; `guid` edits that text. */
  | { kind: 'statusChanged'; status: CodeReviewStatus; comment: string; guid: string }
  | { kind: 'titleChanged'; from: string; to: string }
  /** A merge request moved between states; `changesetId` is the merge's changeset, for one merged. */
  | { kind: 'mergeRequestState'; from: MergeRequestState; to: MergeRequestState; changesetId?: number }
  /** A merge request's destination changed. */
  | { kind: 'destinationChanged'; from: BranchRef; to: BranchRef }
  /** The server hid a merged request's branch, or someone showed it again. */
  | { kind: 'branchHidden' | 'branchUnhidden'; branch: BranchRef }
  /** What this version doesn't read: its text, as the server wrote it. */
  | { kind: 'other'; text: string };

/**
 * A branch the server names in a note, by its object id: `name` once read (`BranchNamesCache`), none for a branch
 * deleted since or a name that couldn't be read.
 */
export interface BranchRef {
  id: number;
  name?: string;
}

/**
 * The changeset a merge request was merged in, from its conversation: the newest move to Merged, unless a later move
 * took it out of Merged (a merge undone). `cm find review` has no field for it: only the server's note names it.
 */
export function mergedChangesetOf(events: readonly ReviewEventChange[]): number | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]!;
    if (event.kind !== 'mergeRequestState') continue;
    return event.to === 'Merged' ? event.changesetId : undefined;
  }
  return undefined;
}

/**
 * The review's description: the text at the top of its conversation, `guid` editing it. `id` is its comment's, which a
 * link to it names (docs/features/deep-links.md).
 */
export interface ReviewDescription {
  id: number;
  guid: string;
  text: string;
  author: string;
  date: string;
  editedDate?: string;
}

/** Everything said on a review, read with one `cm find changereviewcomment`. */
export interface ReviewConversation {
  description?: ReviewDescription;
  comments: ReviewComment[];
  events: ReviewEvent[];
}

/** Where a change request is discussed: its review and its thread, the request's own comment. */
export interface ChangeRequestThread {
  reviewId: number;
  threadId: number;
}
