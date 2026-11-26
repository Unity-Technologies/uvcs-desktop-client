import type { ImageSpot } from '@shared/domain/reviewConversation';
import type { ImagePin, ImageSide } from '../../diff/viewer/image/imageAnnotations';
import { imageEarlierTagOf } from './earlierTag';
import { imageThreadsOfFile, type ImageThread, type ImageThreads } from './fileThreads';
import { useNewImageCommentsStore } from './newImageCommentsStore';
import { NewImageCommentCard } from './NewImageCommentCard';
import { imageSideOf, reviewImagePinsOf } from './reviewImagePins';
import { useReviewSpotAnnotations, type ReviewSpotInput, type SpotCommentKind } from './useReviewSpotAnnotations';

const IMAGE_COMMENTS: SpotCommentKind<ImageSpot, ImageThread, ImageThreads, ImageSide, ImagePin> = {
  on: 'image',
  store: useNewImageCommentsStore,
  threadsOfFile: imageThreadsOfFile,
  pinsOf: reviewImagePinsOf,
  sideOf: imageSideOf,
  newCard: (spot, onSent) => <NewImageCommentCard spot={spot} onSent={onSent} />,
  earlierTag: (thread) => imageEarlierTagOf(thread),
};

/**
 * A review's comments on an image of its diff, for the image viewer (`ImageAnnotationsContext`): a pin per thread on a
 * point or an area (`reviewImagePinsOf`), as `useReviewSpotAnnotations` keeps every kind of spot.
 */
export function useReviewImageAnnotations(input: ReviewSpotInput) {
  return useReviewSpotAnnotations(input, IMAGE_COMMENTS);
}
