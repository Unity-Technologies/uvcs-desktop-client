import type { MemberRef } from '../domain/member';
import type { Place } from '../domain/place';
import type { CodeReview, CodeReviewer, CodeReviewFilter, CodeReviewStatus, CodeReviewSummary, CreateCodeReviewRequest, CreatedMergeRequest, CreateMergeRequestRequest, MergeRequestState, ReviewSubscription } from '../domain/codeReview';

export interface CodeReviewsApi {
  /**
   * The reviews `filter` keeps, as one `cm find review` lists them: branch targets by object id (`targetBranchId`),
   * which `branchNames` names when a view shows them.
   */
  listSummaries(place: Place, filter: CodeReviewFilter): Promise<CodeReviewSummary[]>;
  /**
   * The names of the branches reviews target, by object id (`branchTargetIdsOf`): from the branch lists already read;
   * else one id alone is read by itself (`readBranchName`), and two or more from the names of every branch, read once
   * in a while (`BranchNamesCache`). A branch deleted since has none.
   */
  branchNames(place: Place, branchIds: number[]): Promise<Record<number, string>>;
  /** One review, its target named. */
  get(place: Place, reviewId: number): Promise<CodeReview>;
  /**
   * The review's reviewers, each with its status and whether it's a user or a group (`CodeReviewer.kind`): one
   * `cm codereview reviewer list`, for one review at a time (its page), never a list's rows.
   */
  reviewers(place: Place, reviewId: number): Promise<CodeReviewer[]>;
  create(place: Place, request: CreateCodeReviewRequest): Promise<number>;
  /**
   * Asks to merge a branch into another: one quick `cm mergerequest create`. `cm` checks only that the destination
   * exists; what else makes a request sensible (`draftProblem`) is the window's to check before asking.
   */
  createMergeRequest(place: Place, request: CreateMergeRequestRequest): Promise<CreatedMergeRequest>;
  /** Asks these users and groups to review it too; one already asked stays as they are. */
  addReviewers(place: Place, reviewId: number, reviewers: MemberRef[]): Promise<void>;
  /** Takes these users and groups off its reviewers; the others stay. */
  removeReviewers(place: Place, reviewId: number, reviewers: MemberRef[]): Promise<void>;
  /** Asks these reviewers to review it again: their status goes back to "Under review". */
  reRequestReview(place: Place, reviewId: number, reviewers: MemberRef[]): Promise<void>;
  /** Sets the signed-in user's own status as a reviewer, with what they say about it. */
  setOwnStatus(place: Place, reviewId: number, status: CodeReviewStatus, comment?: string): Promise<void>;
  /** Gives the review a new title; the server notes the rename in its conversation. */
  rename(place: Place, reviewId: number, title: string): Promise<void>;
  remove(place: Place, reviewIds: number[]): Promise<void>;
  /**
   * Whether the signed-in user gets the review's emails, why, and whether its repository sends any: one quick
   * `cm codereview subscription`, for the review shown.
   */
  subscription(place: Place, reviewId: number): Promise<ReviewSubscription>;
  /** Subscribes the signed-in user to the review's emails. */
  subscribe(place: Place, reviewId: number): Promise<void>;
  /**
   * Stops the review's emails to the signed-in user, until they comment on it, someone mentions them or adds them (or a
   * group they're in) as a reviewer: the server subscribes them again then.
   */
  unsubscribe(place: Place, reviewId: number): Promise<void>;
  /**
   * Moves a merge request to another state (`mergeRequestMoves` says which it may take); the server notes the move in
   * its conversation. Needs the change permission on its branch.
   */
  setMergeRequestState(place: Place, reviewId: number, state: MergeRequestState): Promise<void>;
  /** Makes `branch` (`/main/release`) the branch a merge request merges into; the server notes the change. */
  setMergeRequestDestination(place: Place, reviewId: number, branch: string): Promise<void>;
  /**
   * Records a merge request Merged in changeset `changesetId`, after the app merged it: the server notes it in its
   * conversation, once (a request already Merged stays as it is).
   */
  recordMerged(place: Place, reviewId: number, changesetId: number): Promise<void>;
}
