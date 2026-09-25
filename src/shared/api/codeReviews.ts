import type { CodeReview, CodeReviewFilter, CodeReviewStatus, CreateCodeReviewRequest } from '../domain/codeReview';

export interface CodeReviewsApi {
  list(workspacePath: string, filter: CodeReviewFilter): Promise<CodeReview[]>;
  get(workspacePath: string, reviewId: number): Promise<CodeReview>;
  create(workspacePath: string, request: CreateCodeReviewRequest): Promise<number>;
  update(workspacePath: string, reviewId: number, changes: { status?: CodeReviewStatus; assignee?: string }): Promise<void>;
  remove(workspacePath: string, reviewIds: number[]): Promise<void>;
}
