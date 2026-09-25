export const CODE_REVIEW_STATUSES = ['Under review', 'Reviewed', 'Rework required'] as const;

export type CodeReviewStatus = (typeof CODE_REVIEW_STATUSES)[number];

export type CodeReviewTarget =
  | { kind: 'branch'; branch: string }
  | { kind: 'changeset'; changesetId: number }
  /** A target that could not be resolved, e.g. a deleted branch. */
  | { kind: 'unknown'; description: string };

export interface CodeReview {
  id: number;
  title: string;
  status: CodeReviewStatus;
  owner: string;
  assignee: string;
  date: string;
  target: CodeReviewTarget;
}

/** A review without its target, which takes extra `cm` lookups to resolve (branches come back as object ids). */
export type CodeReviewSummary = Omit<CodeReview, 'target'>;

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
  /** `br:/main/task` or `cs:12`. */
  targetSpec: string;
  title: string;
  assignee?: string;
}
