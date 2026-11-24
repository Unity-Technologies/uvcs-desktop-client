/** Which edge of the sized element the splitter sits on: dragging away from the element makes it taller. */
export type ResizeEdge = 'top' | 'bottom';

/**
 * The sized element's height as the pointer moves from `startY` to `y`, from `startSize` when the drag began, within
 * `min` and `max`. On its top edge, dragging up grows it (a pane at the bottom); on its bottom edge, dragging down
 * does (a list at the top).
 */
export function resizedSize(edge: ResizeEdge, drag: { startSize: number; startY: number; y: number }, min: number, max: number): number {
  const moved = edge === 'top' ? drag.startY - drag.y : drag.y - drag.startY;
  return Math.min(max, Math.max(min, drag.startSize + moved));
}
