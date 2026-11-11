import type { CodeReviewStatus } from './codeReview';

/**
 * What a review comment is, as the server types it:
 * - `general`: on the whole review, the conversation's own comments;
 * - `comment`, `changeRequest`, `question`: on a file's line. A change request stays open until a changeset applies it
 *   or someone discards it; a question until someone answers it. A reply is a `comment`;
 * - `discard`: the reply that discards a change request, saying why.
 */
export type ReviewCommentKind = 'general' | 'comment' | 'changeRequest' | 'question' | 'discard';

/** Where a comment is: the whole review, or a line of one revision of a file (1-based, as an editor counts). */
export type ReviewCommentAnchor = { kind: 'review' } | { kind: 'line'; revisionId: number; itemId: number; path: string; line: number };

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
  /** The changeset whose diff it was written in, changeset by changeset; none for the whole branch's diff. */
  changesetId?: number;
  /** The changeset that applied a change request. */
  appliedInChangeset?: number;
}

/** The kinds a comment on a line is written as: the reviewer picks one, and it can't change once posted. */
export type LineCommentKind = Extract<ReviewCommentKind, 'changeRequest' | 'question' | 'comment'>;

/**
 * Where a new comment on a line goes, and as what: a line (1-based) of the revision the review's diff shows (the newer
 * side's, or a deleted file's last one), and the changeset whose diff it's written in, changeset by changeset.
 */
export interface NewLineComment {
  revisionId: number;
  line: number;
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
  /** What this version doesn't read yet (a merge request's statuses and destination, a branch hidden): its text. */
  | { kind: 'other'; text: string };

/** The review's description: the text at the top of its conversation, `guid` editing it. */
export interface ReviewDescription {
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
