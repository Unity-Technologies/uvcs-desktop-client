import type { Place } from '../domain/place';
import type { CodeReview, CodeReviewFilter, CodeReviewStatus, CodeReviewSummary, CreateCodeReviewRequest } from '../domain/codeReview';

export interface CodeReviewsApi {
  list(place: Place, filter: CodeReviewFilter): Promise<CodeReview[]>;
  /** Like `list`, but a single `cm find`: for searches that never show the targets. */
  listSummaries(place: Place, filter: CodeReviewFilter): Promise<CodeReviewSummary[]>;
  get(place: Place, reviewId: number): Promise<CodeReview>;
  create(place: Place, request: CreateCodeReviewRequest): Promise<number>;
  /** Asks these users to review it too; one already asked stays as they are. */
  addReviewers(place: Place, reviewId: number, users: string[]): Promise<void>;
  /** Sets the signed-in user's own status as a reviewer, with what they say about it. */
  setOwnStatus(place: Place, reviewId: number, status: CodeReviewStatus, comment?: string): Promise<void>;
  remove(place: Place, reviewIds: number[]): Promise<void>;
}
