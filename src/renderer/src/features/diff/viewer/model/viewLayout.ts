// Where each version is drawn on the one canvas, per mode. Split gives each version a half with its own aspect;
// swipe draws both through one full-size view, each cut to its side of the divider; onion draws both full size, to be
// blended; differences draws the version after full size and the version before's ghost over it, in its depth;
// differences by look draws both full size, to be compared pixel by pixel; a version shown alone takes it all.
// Rectangles are in canvas pixels from the bottom left, as WebGL counts.

import type { DiffsCompares } from './surfaceLook';

export type ModelLayoutMode = 'single' | 'sideBySide' | 'onion' | 'swipe' | 'differences' | 'lookDifferences';
export type Side = 'before' | 'after';
/** The modes a person chooses (the header's): the others are what the view shows for them (`shownLayoutMode`). */
export type ChosenLayoutMode = Exclude<ModelLayoutMode, 'single' | 'lookDifferences'>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Pane {
  side: Side;
  /** What the camera sees: its aspect is this rectangle's. */
  viewport: Rect;
  /** What of it is drawn. */
  scissor: Rect;
  /** Drawn over the pane before it, in its depth, without the grid again. */
  overlay?: true;
}

export interface Layout {
  panes: Pane[];
  /**
   * How the panes reach the canvas: straight onto it, or drawn apart and then blended (onion skin, `Blender`) or
   * compared pixel by pixel (Diffs by look, `LookComparer`).
   */
  drawn: 'direct' | 'blended' | 'compared';
}

/**
 * How a mode is laid out: as itself, but Diffs with the materials shown compares how the versions look, once both
 * versions' textures are loaded (compared sooner, a texture one side has and the other is still loading would light
 * up as a change); until then the version after shows alone.
 */
export function shownLayoutMode(mode: ChosenLayoutMode, compares: DiffsCompares, looksLoaded: boolean): ModelLayoutMode {
  if (mode !== 'differences' || compares === 'shape') return mode;
  return looksLoaded ? 'lookDifferences' : 'single';
}

/** `split`: the swipe divider, as a fraction of the width. `only`: the side shown alone. */
export function layoutOf(mode: ModelLayoutMode, width: number, height: number, split = 0.5, only: Side = 'after'): Layout {
  const full: Rect = { x: 0, y: 0, width, height };
  switch (mode) {
    case 'single':
      return { panes: [{ side: only, viewport: full, scissor: full }], drawn: 'direct' };
    case 'sideBySide': {
      // The before half takes the odd pixel: the halves never overlap nor leave a gap.
      const left = Math.ceil(width / 2);
      const before: Rect = { x: 0, y: 0, width: left, height };
      const after: Rect = { x: left, y: 0, width: width - left, height };
      return { panes: [{ side: 'before', viewport: before, scissor: before }, { side: 'after', viewport: after, scissor: after }], drawn: 'direct' };
    }
    case 'swipe': {
      const at = Math.round(Math.min(1, Math.max(0, split)) * width);
      return {
        panes: [
          { side: 'before', viewport: full, scissor: { x: 0, y: 0, width: at, height } },
          { side: 'after', viewport: full, scissor: { x: at, y: 0, width: width - at, height } },
        ],
        drawn: 'direct',
      };
    }
    case 'onion':
      return { panes: [{ side: 'before', viewport: full, scissor: full }, { side: 'after', viewport: full, scissor: full }], drawn: 'blended' };
    case 'differences':
      return { panes: [{ side: 'after', viewport: full, scissor: full }, { side: 'before', viewport: full, scissor: full, overlay: true }], drawn: 'direct' };
    case 'lookDifferences':
      // The version after first: a click picks it, as it is the one shown.
      return { panes: [{ side: 'after', viewport: full, scissor: full }, { side: 'before', viewport: full, scissor: full }], drawn: 'compared' };
  }
}

/**
 * The pane under a point of the canvas (CSS pixels from the top left, as pointer events give them). Onion panes
 * overlap: this is the before's, and the viewer picks by the blend.
 */
export function paneAt(layout: Layout, x: number, y: number, height: number, pixelRatio: number): Pane | null {
  const px = x * pixelRatio;
  const py = (height - y) * pixelRatio;
  return layout.panes.find(({ scissor }) => px >= scissor.x && px < scissor.x + scissor.width && py >= scissor.y && py < scissor.y + scissor.height) ?? null;
}
