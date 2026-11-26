import type { ReviewApi } from '@shared/api/review';
import type { ServiceContext } from './ServiceContext';

export function createReviewService({ reviews, diffReviews }: ServiceContext): ReviewApi {
  return {
    marks: (workspacePath) => reviews.marks(workspacePath),
    mark: (workspacePath, paths) => reviews.mark(workspacePath, paths),
    unmark: (workspacePath, paths) => reviews.unmark(workspacePath, paths),
    keepOnly: (workspacePath, pendingPaths) => reviews.keepOnly(workspacePath, pendingPaths),
    diffMarks: (repository, diff, formerDiff) => diffReviews.marks(repository, diff, formerDiff),
    markDiff: (repository, diff, marks, formerDiff) => diffReviews.mark(repository, diff, marks, formerDiff),
    unmarkDiff: (repository, diff, paths, formerDiff) => diffReviews.unmark(repository, diff, paths, formerDiff),
  };
}
