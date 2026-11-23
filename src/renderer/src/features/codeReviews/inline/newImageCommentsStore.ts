import type { NewImageCommentSpot } from './newImageComment';
import { createNewSpotCommentsStore } from './newSpotCommentsStore';

/** The comments being written on images of reviews' diffs, while the window lives (`createNewSpotCommentsStore`). */
export const useNewImageCommentsStore = createNewSpotCommentsStore<NewImageCommentSpot>();
