import type { Place } from '../domain/place';
import type { CodeReview, CodeReviewFilter, CodeReviewStatus, CodeReviewSummary, CreateCodeReviewRequest } from '../domain/codeReview';

export interface CodeReviewsApi {
  list(place: Place, filter: CodeReviewFilter): Promise<CodeReview[]>;
  /** Like `list`, but a single `cm find`: for searches that never show the targets. */
  listSummaries(place: Place, filter: CodeReviewFilter): Promise<CodeReviewSummary[]>;
  get(place: Place, reviewId: number): Promise<CodeReview>;
  create(place: Place, request: CreateCodeReviewRequest): Promise<number>;
  update(place: Place, reviewId: number, changes: { status?: CodeReviewStatus; assignee?: string }): Promise<void>;
  remove(place: Place, reviewIds: number[]): Promise<void>;
}
