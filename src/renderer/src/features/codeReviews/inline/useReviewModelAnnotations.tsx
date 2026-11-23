import type { ModelSpot } from '@shared/domain/reviewConversation';
import type { ModelPin } from '../../diff/viewer/model/modelAnnotations';
import type { Side } from '../../diff/viewer/model/viewLayout';
import { modelEarlierTagOf } from './earlierTag';
import { modelThreadsOfFile, type ModelThread, type ModelThreads } from './fileThreads';
import { useNewModelCommentsStore } from './newModelCommentsStore';
import { NewModelCommentCard } from './NewModelCommentCard';
import { modelSideOf, reviewModelPinsOf } from './reviewModelPins';
import { useReviewSpotAnnotations, type ReviewSpotInput, type SpotCommentKind } from './useReviewSpotAnnotations';

const MODEL_COMMENTS: SpotCommentKind<ModelSpot, ModelThread, ModelThreads, Side, ModelPin> = {
  on: 'model',
  store: useNewModelCommentsStore,
  threadsOfFile: modelThreadsOfFile,
  pinsOf: reviewModelPinsOf,
  sideOf: modelSideOf,
  newCard: (spot, onSent) => <NewModelCommentCard spot={spot} onSent={onSent} />,
  earlierTag: (thread, placed) => modelEarlierTagOf(thread, placed?.partGone ?? false),
};

/**
 * A review's comments on a 3D model of its diff, for the model viewer (`ModelAnnotationsContext`): a pin per thread on
 * a point or a part (`reviewModelPinsOf`), the camera taken to one gone to, as `useReviewSpotAnnotations` keeps every
 * kind of spot.
 */
export function useReviewModelAnnotations(input: ReviewSpotInput) {
  return useReviewSpotAnnotations(input, MODEL_COMMENTS);
}
