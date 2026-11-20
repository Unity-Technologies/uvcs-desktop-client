import type { Point } from './curves';
import { toScreen, type Viewport } from './viewport';

/** Where a world point lies on the page, for a canvas whose top-left corner is at `bounds`. */
export function clientPointOf(bounds: Pick<DOMRect, 'left' | 'top'>, viewport: Viewport, world: Point): Point {
  const screen = toScreen(viewport, world.x, world.y);
  return { x: bounds.left + screen.x, y: bounds.top + screen.y };
}

/**
 * Opens the graph's context menu at a world point, as a right-click there would: the menu is the canvas container's
 * (`ActionContextMenu`), which opens on a `contextmenu` event. The menu key and the "More actions" buttons open it this
 * way; the caller sets what the menu is for first.
 */
export function openContextMenuAt(canvas: HTMLCanvasElement, viewport: Viewport, world: Point): void {
  const point = clientPointOf(canvas.getBoundingClientRect(), viewport, world);
  canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y }));
}
