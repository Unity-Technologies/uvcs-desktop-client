export const CODE_REVIEW_STATUSES = ['Under review', 'Reviewed', 'Rework required'] as const;

export type CodeReviewStatus = (typeof CODE_REVIEW_STATUSES)[number];

/**
 * A user or group asked to review, with the status they gave it (`cm codereview review`). The review's own status
 * follows from theirs (the server's rule): Rework required when anyone asks for it, Reviewed once everyone has.
 */
export interface CodeReviewer {
  name: string;
  status: CodeReviewStatus;
}

export type CodeReviewTarget =
  | { kind: 'branch'; branch: string }
  | { kind: 'changeset'; changesetId: number }
  | { kind: 'shelve'; shelveId: number }
  /** A target that could not be resolved, e.g. a deleted branch. */
  | { kind: 'unknown'; description: string };

/**
 * A review as `cm find review` lists it. A branch target comes as the branch's object id: enough to find the review of
 * a branch already read (branch lists have ids), while its name takes the list of every branch (`CodeReview`). A
 * changeset or shelve target is named by its number in the same record, so it comes named (`target`).
 */
export interface CodeReviewSummary {
  id: number;
  title: string;
  status: CodeReviewStatus;
  owner: string;
  reviewers: CodeReviewer[];
  date: string;
  /** When anyone last did something on it: a comment, a status, a rename. */
  lastActivity: string;
  /** Comments, questions, change requests and their replies. */
  commentCount: number;
  /** Change requests not applied or discarded yet, and questions nobody answered. */
  openIssueCount: number;
  /** Object id of the reviewed branch; none for other targets. */
  targetBranchId?: number;
  /** The reviewed changeset or shelve; a branch only once its name is read (`CodeReview`). */
  target?: CodeReviewTarget;
}

/** A review with its target named. */
export interface CodeReview extends CodeReviewSummary {
  target: CodeReviewTarget;
}

export interface CodeReviewFilter {
  /** Only reviews created by one of these users, as `QueryFilter.owners`. */
  owners?: readonly string[];
  /** Only reviews the user is one of the reviewers of. */
  reviewerIsMe?: boolean;
  status?: CodeReviewStatus;
  /** `YYYY-MM-DD`; only reviews created on or after it. */
  sinceDate?: string;
  /** Only reviews whose title contains it. */
  text?: string;
}

/** Repositories can hold thousands of reviews; lists show the newest ones up to this many. */
export const MAX_LISTED_CODE_REVIEWS = 300;

export interface CreateCodeReviewRequest {
  /** `br:/main/task`, `cs:12` or `sh:3`. */
  targetSpec: string;
  title: string;
  /** The users asked to review it. */
  reviewers?: string[];
}
