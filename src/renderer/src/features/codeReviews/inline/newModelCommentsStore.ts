import type { NewModelCommentSpot } from './newSpotComment';
import { createNewSpotCommentsStore } from './newSpotCommentsStore';

/** The comments being written on 3D models of reviews' diffs, while the window lives (`createNewSpotCommentsStore`). */
export const useNewModelCommentsStore = createNewSpotCommentsStore<NewModelCommentSpot>();
