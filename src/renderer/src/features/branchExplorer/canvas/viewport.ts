/** Maps world coordinates to the screen: `screen = world * zoom + pan`. */
export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 3;

export function toWorld(viewport: Viewport, screenX: number, screenY: number): { x: number; y: number } {
  return { x: (screenX - viewport.panX) / viewport.zoom, y: (screenY - viewport.panY) / viewport.zoom };
}

/** Zooms by `factor` keeping the world point under the screen position still. */
export function zoomAt(viewport: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  const zoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const world = toWorld(viewport, screenX, screenY);
  return { zoom, panX: screenX - world.x * zoom, panY: screenY - world.y * zoom };
}

/** Centers a world point on the screen at the current zoom. */
export function centerOn(viewport: Viewport, worldX: number, worldY: number, screen: Size): Viewport {
  return { ...viewport, panX: screen.width / 2 - worldX * viewport.zoom, panY: screen.height / 2 - worldY * viewport.zoom };
}

/** Zooms out (never in beyond 1:1) so the whole graph fits on screen, centered horizontally and aligned to the top. */
export function fitToScreen(content: Size, screen: Size): Viewport {
  const zoom = clamp(Math.min(screen.width / content.width, screen.height / content.height, 1), MIN_ZOOM, MAX_ZOOM);
  return { zoom, panX: (screen.width - content.width * zoom) / 2, panY: 0 };
}

/** Where the focus point sits horizontally when opening a graph wider than the screen: recent history on the right. */
const OPENING_FOCUS_X = 0.72;

/**
 * The first view of a graph: everything if it fits at 1:1; otherwise 1:1 with the focus point towards
 * the right (so the history leading to it is visible) and the top rows in view.
 */
export function openingViewport(content: Size, screen: Size, focusX: number, focusY: number): Viewport {
  if (content.width <= screen.width && content.height <= screen.height) return fitToScreen(content, screen);

  const panX = Math.max(screen.width - content.width, Math.min(0, screen.width * OPENING_FOCUS_X - focusX));
  const panY = focusY < screen.height * 0.8 ? 0 : screen.height / 2 - focusY;
  return { zoom: 1, panX, panY };
}

const REVEAL_MARGIN = { x: 80, y: 40 };

/** Keeps the world point visible: nothing moves if it already is, otherwise it is centered. */
export function revealPoint(viewport: Viewport, worldX: number, worldY: number, screen: Size): Viewport {
  const x = worldX * viewport.zoom + viewport.panX;
  const y = worldY * viewport.zoom + viewport.panY;
  const inside =
    x >= REVEAL_MARGIN.x && x <= screen.width - REVEAL_MARGIN.x && y >= REVEAL_MARGIN.y && y <= screen.height - REVEAL_MARGIN.y;
  return inside ? viewport : centerOn(viewport, worldX, worldY, screen);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
