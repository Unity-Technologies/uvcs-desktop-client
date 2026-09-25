import type { ReviewApi } from '@shared/api/review';
import type { ServiceContext } from './ServiceContext';

export function createReviewService({ reviews }: ServiceContext): ReviewApi {
  return {
    marks: (workspacePath) => reviews.marks(workspacePath),
    mark: (workspacePath, paths) => reviews.mark(workspacePath, paths),
    unmark: (workspacePath, paths) => reviews.unmark(workspacePath, paths),
    keepOnly: (workspacePath, pendingPaths) => reviews.keepOnly(workspacePath, pendingPaths),
  };
}
