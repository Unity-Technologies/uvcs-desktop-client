import type { ReviewApi } from '@shared/api/review';
import { placeId } from '@shared/domain/place';
import { movedReviewMode } from '@shared/domain/reviewModePlaces';
import { reviewModeKeyOf, type PlaceGuids } from '../review/reviewModeKey';
import { readWorkspaceGuid } from '../workspace/workspaceIdentity';
import type { ServiceContext } from './ServiceContext';

export function createReviewService({ reviews, diffReviews, settings, headers, repositoryGuids }: ServiceContext): ReviewApi {
  const guids: PlaceGuids = {
    workspace: (workspacePath) => readWorkspaceGuid(headers, workspacePath),
    repository: (server, name) => repositoryGuids.guidOf(server, name),
  };

  return {
    async reviewModeKey(place) {
      const key = await reviewModeKeyOf(place, guids);
      // Kept by its path or spec before: it moves to the GUID now that it's known.
      const moved = movedReviewMode(settings.get().reviewModeWorkspaces, placeId(place), key);
      if (moved) settings.update({ reviewModeWorkspaces: moved });
      return key;
    },
    marks: (workspacePath) => reviews.marks(workspacePath),
    mark: (workspacePath, paths) => reviews.mark(workspacePath, paths),
    unmark: (workspacePath, paths) => reviews.unmark(workspacePath, paths),
    keepOnly: (workspacePath, pendingPaths) => reviews.keepOnly(workspacePath, pendingPaths),
    diffMarks: (repository, diff) => diffReviews.marks(repository, diff),
    markDiff: (repository, diff, marks) => diffReviews.mark(repository, diff, marks),
    unmarkDiff: (repository, diff, paths) => diffReviews.unmark(repository, diff, paths),
  };
}
