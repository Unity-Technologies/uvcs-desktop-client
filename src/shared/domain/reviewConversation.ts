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

/** Where a comment is: the whole review, or lines of one revision of a file (one line, or a range of them). */
export type ReviewCommentAnchor = { kind: 'review' } | ({ kind: 'line'; revisionId: number; itemId: number; path: string } & LineRange);

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

/** The kinds a comment on a line is written as: the reviewer picks one, and it can't change once posted. */
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
