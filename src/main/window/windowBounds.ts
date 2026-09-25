import type { SavedWindowBounds } from '@shared/domain/settings';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_WINDOW_WIDTH = 960;
export const MIN_WINDOW_HEIGHT = 600;

/** How much of the window's top edge must be on a screen for the user to see and drag it. */
const GRAB_WIDTH = 120;
const GRAB_HEIGHT = 40;

/**
 * Fits the saved window bounds to the displays attached now (a monitor may be gone, or smaller):
 * the size shrinks to the display it mostly lies on, and a window whose title bar ended up off every
 * screen is centered on the nearest display. Returns null when nothing usable was saved.
 */
export function restoreWindowBounds(saved: SavedWindowBounds | null, workAreas: Rect[]): Rect | null {
  if (!saved || workAreas.length === 0 || ![saved.x, saved.y, saved.width, saved.height].every(Number.isFinite)) return null;

  const home = displayOf(saved, workAreas);
  const width = Math.round(Math.max(MIN_WINDOW_WIDTH, Math.min(saved.width, home.width)));
  const height = Math.round(Math.max(MIN_WINDOW_HEIGHT, Math.min(saved.height, home.height)));
  const bounds = { x: Math.round(saved.x), y: Math.round(saved.y), width, height };
  if (workAreas.some((area) => canGrab(bounds, area))) return bounds;

  return {
    x: home.x + Math.max(0, Math.round((home.width - width) / 2)),
    y: home.y + Math.max(0, Math.round((home.height - height) / 2)),
    width,
    height,
  };
}

/** The display the window overlaps most, or the nearest one if it overlaps none (its monitor was unplugged). */
function displayOf(bounds: Rect, workAreas: Rect[]): Rect {
  const byOverlap = [...workAreas].sort((a, b) => overlap(bounds, b) - overlap(bounds, a));
  if (overlap(bounds, byOverlap[0]!) > 0) return byOverlap[0]!;
  return [...workAreas].sort((a, b) => centerDistance(bounds, a) - centerDistance(bounds, b))[0]!;
}

function overlap(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return Math.max(0, width) * Math.max(0, height);
}

function centerDistance(a: Rect, b: Rect): number {
  return Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
}

function canGrab(bounds: Rect, area: Rect): boolean {
  const visibleWidth = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
  return visibleWidth >= GRAB_WIDTH && bounds.y >= area.y && bounds.y + GRAB_HEIGHT <= area.y + area.height;
}
