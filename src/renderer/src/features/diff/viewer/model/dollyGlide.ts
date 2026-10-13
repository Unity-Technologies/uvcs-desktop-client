// A mouse wheel's notches zoom the model as they zoom the Branch Explorer: each an eased glide (`ZoomGlide`), never a
// jump, and spinning faster compounds them up to a ceiling (`wheelZoomFactor`). Each notch jumping at once, by as much
// as the wheel said, threw a model out of sight when a mouse was spun fast (macOS speeds a fast wheel up); a trackpad's
// many small deltas already read smooth and stay 1:1 (`dollied`).

import type { FrameClock } from '../../../../lib/frameClock';
import { ZoomGlide } from '../../../../lib/zoomGlide';
import { dolliedTo, MIN_DISTANCE, type OrbitView, type Vector } from './orbitCamera';

/**
 * The glide zooms closeness, the distance's inverse, towards the point under the pointer (none: the target). Anything
 * else that sets the view (a drag, F, the keys) stops it where it is (`useModelCamera`).
 */
export function dollyGlide(view: () => OrbitView, onView: (view: OrbitView) => void, clock: FrameClock): ZoomGlide<Vector | null> {
  return new ZoomGlide<Vector | null>((point, closeness) => onView(dolliedTo(view(), 1 / closeness, point)), () => 1 / view().distance, clock, { min: 0, max: 1 / MIN_DISTANCE });
}
