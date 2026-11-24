import type { ModelSpot } from '@shared/domain/reviewConversation';
import { modelPartName } from '../conversation/threadBadges';

/** What a comment on a 3D model is about: a point of its surface, or the whole part it's on. */
export type ModelCommentAbout = 'point' | 'part';

/**
 * What a comment being written on a model can be about, and the part's name to say what "part" means: offered only
 * on a point of a part (a click on a mesh); none for a point the file names no part for.
 */
export function modelCommentAboutOf(spot: ModelSpot): { about: ModelCommentAbout; partName: string } | null {
  const partName = modelPartName(spot);
  return partName === null ? null : { about: spot.wholePart ? 'part' : 'point', partName };
}

/** The spot about its point, or its whole part: the same point either way, so the bubble stays where it was. */
export function spotAbout(spot: ModelSpot, about: ModelCommentAbout): ModelSpot {
  const { wholePart: _, ...point } = spot;
  return about === 'part' && spot.node ? { ...point, wholePart: true } : point;
}
