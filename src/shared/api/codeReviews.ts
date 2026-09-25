import type { CodeReview, CodeReviewFilter, CodeReviewStatus, CodeReviewSummary, CreateCodeReviewRequest } from '../domain/codeReview';

export interface CodeReviewsApi {
  list(workspacePath: string, filter: CodeReviewFilter): Promise<CodeReview[]>;
  /** Like `list`, but a single `cm find`: for searches that never show the targets. */
  listSummaries(workspacePath: string, filter: CodeReviewFilter): Promise<CodeReviewSummary[]>;
  get(workspacePath: string, reviewId: number): Promise<CodeReview>;
  create(workspacePath: string, request: CreateCodeReviewRequest): Promise<number>;
  update(workspacePath: string, reviewId: number, changes: { status?: CodeReviewStatus; assignee?: string }): Promise<void>;
  remove(workspacePath: string, reviewIds: number[]): Promise<void>;
}
