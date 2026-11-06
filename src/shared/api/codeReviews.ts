import type { MemberRef } from '../domain/member';
import type { Place } from '../domain/place';
import type { CodeReview, CodeReviewFilter, CodeReviewStatus, CodeReviewSummary, CreateCodeReviewRequest } from '../domain/codeReview';

export interface CodeReviewsApi {
  list(place: Place, filter: CodeReviewFilter): Promise<CodeReview[]>;
  /** Like `list`, but a single `cm find`: for searches that never show the targets. */
  listSummaries(place: Place, filter: CodeReviewFilter): Promise<CodeReviewSummary[]>;
  get(place: Place, reviewId: number): Promise<CodeReview>;
  create(place: Place, request: CreateCodeReviewRequest): Promise<number>;
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
}
