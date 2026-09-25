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

/**
 * Room kept at the top when zoomed out: the graph's own top padding shrinks with the zoom, and
 * would no longer clear the date ruler and the branch names above the first band.
 */
const FIT_TOP_MARGIN = 28;

/** Where the top of the graph sits when it is pinned to the top of the screen. */
function pinnedTop(zoom: number): number {
  return FIT_TOP_MARGIN * Math.max(0, 1 - zoom);
}

/** Zooms out (never in beyond 1:1) so the whole graph fits on screen, aligned to the top left. */
export function fitToScreen(content: Size, screen: Size): Viewport {
  const zoom = clamp(Math.min(screen.width / content.width, (screen.height - FIT_TOP_MARGIN) / content.height, 1), MIN_ZOOM, MAX_ZOOM);
  return { zoom, panX: 0, panY: pinnedTop(zoom) };
}

/** How far a graph larger than the screen can be dragged past its edges. */
export const OVERSCROLL = 80;

/**
 * Keeps the graph on screen. Along an axis where it fits, it stays pinned to the top left; where it
 * is larger than the screen it pans freely, with a little room past its edges (none above the top,
 * so the first rows always stay clear of the date ruler).
 */
export function clampViewport(viewport: Viewport, content: Size, screen: Size): Viewport {
  const width = content.width * viewport.zoom;
  const height = content.height * viewport.zoom;
  const top = pinnedTop(viewport.zoom);
  const panX = width <= screen.width ? 0 : clamp(viewport.panX, screen.width - width - OVERSCROLL, OVERSCROLL);
  const panY = height <= screen.height - top ? top : clamp(viewport.panY, screen.height - height - OVERSCROLL / 2, top);
  return panX === viewport.panX && panY === viewport.panY ? viewport : { ...viewport, panX, panY };
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

/** Framing something zooms in at least this far, so it is readable. */
const FRAME_MIN_ZOOM = 0.8;

/** Centers a world point, zooming in if the graph is too small to read there. */
export function frameOn(viewport: Viewport, worldX: number, worldY: number, screen: Size): Viewport {
  return centerOn({ ...viewport, zoom: Math.max(viewport.zoom, FRAME_MIN_ZOOM) }, worldX, worldY, screen);
}

/**
 * The viewport `t` (0 to 1) of the way between two, moving the point at the middle of the screen in
 * a straight line and the zoom at a steady rate, so a glide never swings off to the side.
 */
export function interpolateViewport(from: Viewport, to: Viewport, t: number, screen: Size): Viewport {
  const middle = (viewport: Viewport): { x: number; y: number } => toWorld(viewport, screen.width / 2, screen.height / 2);
  const start = middle(from);
  const end = middle(to);
  const zoom = from.zoom * (to.zoom / from.zoom) ** t;
  return centerOn({ panX: 0, panY: 0, zoom }, start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t, screen);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
