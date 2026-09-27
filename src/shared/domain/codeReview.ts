export const CODE_REVIEW_STATUSES = ['Under review', 'Reviewed', 'Rework required'] as const;

export type CodeReviewStatus = (typeof CODE_REVIEW_STATUSES)[number];

export type CodeReviewTarget =
  | { kind: 'branch'; branch: string }
  | { kind: 'changeset'; changesetId: number }
  | { kind: 'shelve'; shelveId: number }
  /** A target that could not be resolved, e.g. a deleted branch. */
  | { kind: 'unknown'; description: string };

/**
 * A review as `cm find review` lists it. A branch target comes as the branch's object id: enough to find the review of
 * a branch already read (branch lists have ids), while its name takes the list of every branch (`CodeReview`).
 */
export interface CodeReviewSummary {
  id: number;
  title: string;
  status: CodeReviewStatus;
  owner: string;
  assignee: string;
  date: string;
  /** Object id of the reviewed branch; none for other targets. */
  targetBranchId?: number;
}

/** A review with its target named. */
export interface CodeReview extends CodeReviewSummary {
  target: CodeReviewTarget;
}

export interface CodeReviewFilter {
  scope: 'all' | 'createdByMe' | 'assignedToMe';
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
  assignee?: string;
}
