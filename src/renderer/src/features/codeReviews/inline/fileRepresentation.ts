import type { RepresentationComments } from '../../diff/viewer/representationComments';
import type { ThreadFocus } from './reviewComments';

interface FileRepresentationInput {
  /** How many threads the file's code shows (at lines, or outdated). */
  onText: number;
  onImage: number;
  focus: ThreadFocus | null;
  /** Where the thread gone to is in this file: on its lines, on its image, or not in it. */
  focusedOn: 'text' | 'image' | null;
}

/**
 * A review's comments on a file shown either as code or as an image (an SVG): those on lines are in its code, those on
 * a point or an area in its image. A thread gone to from elsewhere asks for the way it's on; one picked in place
 * (`ThreadFocus.inPlace`) is on screen already and asks for nothing.
 */
export function representationCommentsOf({ onText, onImage, focus, focusedOn }: FileRepresentationInput): RepresentationComments {
  const asks = focus !== null && !focus.inPlace && focusedOn !== null;
  return { onText, onImage, asked: asks ? { representation: focusedOn, seq: focus.seq } : null };
}
