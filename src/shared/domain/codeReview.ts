import type { MemberKind, MemberRef } from './member';

export const CODE_REVIEW_STATUSES = ['Under review', 'Reviewed', 'Rework required'] as const;

export type CodeReviewStatus = (typeof CODE_REVIEW_STATUSES)[number];

/** Where a merge request stands, as `cm` names it (`{mergerequeststatus}`, English whatever the language). */
export const MERGE_REQUEST_STATES = ['Draft', 'Open', 'Merged', 'Closed'] as const;

export type MergeRequestState = (typeof MERGE_REQUEST_STATES)[number];

/**
 * What makes a review a merge request: the branch it merges into and where that stands. A merge request is a code
 * review of a branch on the server, with these two more fields (docs/features/merge-requests.md).
 */
export interface MergeRequestInfo {
  state: MergeRequestState;
  /** The destination branch's name, `/main`. */
  destination: string;
}

/**
 * A user or group asked to review, with the status they gave it (`cm codereview review`). The review's own status
 * follows from theirs (the server's rule): Rework required when anyone asks for it, Reviewed once everyone has.
 */
export interface CodeReviewer {
  name: string;
  status: CodeReviewStatus;
  /**
   * A user or a group, where it was read from the review alone (`cm codereview reviewer list`, `CodeReviewsApi.reviewers`).
   * A list of reviews doesn't know it: `cm find review` prints the names only.
   */
  kind?: MemberKind;
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
  /** Where it merges and where that stands; none for a plain code review. */
  mergeRequest?: MergeRequestInfo;
}

/** A review with its target named. */
export interface CodeReview extends CodeReviewSummary {
  target: CodeReviewTarget;
}

export interface CodeReviewFilter {
  /** Only the review with this number: the palette's lookup of a number typed. */
  id?: number;
  /**
   * Only the reviews of this branch (`/main/task`): the reviews whose change requests a check-in on it can apply
   * (`useBranchChangeRequests`). `cm` fails for a branch that doesn't exist.
   */
  targetBranch?: string;
  /**
   * Only the reviews of these branches, by object id, at most `BRANCH_REVIEWS_BLOCK`: the branches a view shows,
   * asked for in blocks (`branchReviewsLoaderOf`).
   */
  targetBranchIds?: readonly number[];
  /** Only reviews created by one of these users, as `QueryFilter.owners`. */
  owners?: readonly string[];
  /** Only reviews the user is one of the reviewers of. */
  reviewerIsMe?: boolean;
  status?: CodeReviewStatus;
  /** Only merge requests in this state (plain code reviews have none). */
  mergeRequestState?: MergeRequestState;
  /** `YYYY-MM-DD`; only reviews created on or after it. */
  sinceDate?: string;
  /** Only reviews whose title contains it. */
  text?: string;
  /**
   * The newest ones up to this many; none reads every review the other fields keep, as the Merge requests view does
   * (a large repository holds thousands: its time range bounds them).
   */
  limit?: number;
}

/**
 * The newest reviews the palette reads (`reviewSummariesQuery`): enough for the reviews in flight, read rarely; an
 * older one is found by its title or number (`usePaletteServerSearch`).
 */
export const NEWEST_CODE_REVIEWS = 300;

/**
 * The most branches one read of their reviews asks for (`CodeReviewFilter.targetBranchIds`). The server answers their
 * `targetid` conditions ORed in one scan of the reviews: 50 cost what one does (about 1.2 s with `cm` starting, on a
 * repository of ~7,000 reviews), so a block is as wide as the rows a view shows and a margin.
 */
export const BRANCH_REVIEWS_BLOCK = 50;

/**
 * Why the signed-in user gets a review's emails or doesn't, as `cm codereview subscription` names it: they wrote it
 * (`owner`), review it, commented, were mentioned, or subscribed themselves (`manual`); they unsubscribed; `none`, no
 * subscription of their own (a reviewer group they belong to may still send them); `other`, a reason `cm` doesn't know.
 */
export const REVIEW_SUBSCRIPTION_REASONS = ['owner', 'reviewer', 'commented', 'mentioned', 'manual', 'unsubscribed', 'none', 'other'] as const;

export type ReviewSubscriptionReason = (typeof REVIEW_SUBSCRIPTION_REASONS)[number];

/** Whether the signed-in user gets a review's emails, and why (`CodeReviewsApi.subscription`). */
export interface ReviewSubscription {
  subscribed: boolean;
  reason: ReviewSubscriptionReason;
  /**
   * Whether the review's repository sends review emails at all (its "Code Review Email Trigger"); false too when the
   * user can't see that trigger. While false, being subscribed sends nothing, though it's kept.
   */
  emailsEnabled: boolean;
}

export interface CreateCodeReviewRequest {
  /** `br:/main/task`, `cs:12` or `sh:3`. */
  targetSpec: string;
  title: string;
  /** The users and groups asked to review it. */
  reviewers?: MemberRef[];
}

/**
 * A new merge request (`CodeReviewsApi.createMergeRequest`): a review of `source` asking to merge it into
 * `destination`, both branch names (`/main/task`, `/main`).
 */
export interface CreateMergeRequestRequest {
  source: string;
  destination: string;
  title: string;
  /** What it's about, several lines in the comments' markup; none leaves it without one. */
  description?: string;
  /** Created as a Draft, not ready to review or merge yet; else Open. */
  draft: boolean;
  /** The users and groups asked to review it. */
  reviewers?: MemberRef[];
}

/**
 * The merge request just made. `descriptionSaved` false: it exists, but `cm` couldn't save its description, which is
 * written after the request is made.
 */
export interface CreatedMergeRequest {
  id: number;
  descriptionSaved: boolean;
}
