import type { ChangeScroll } from './changeView';

/**
 * What one frame of scrolling to a change decides (`scrollToChange`), from what the diff shows on that frame
 * (`ChangeScrollFrame`). A change not rendered yet is jumped to where Pierre estimates it, once; once its rows render,
 * they're scrolled to. After a jump, the rows above it render on the frames that follow at their real heights, which
 * moves it again (a wrapped line taller than its estimate; Pierre keeps the rows it measures where they stood, not the
 * change): so it's placed again on each frame, until it stands in its place on two frames in a row
 * (`SETTLED_FRAMES`). Placed once only, a change below wrapped lines stood 1700 px lower, out of view.
 */
export type ChangeScrollStep =
  /** Done: the change is in place, or in view as a diff opens. */
  | { kind: 'done' }
  /** Jump to where Pierre lays the change out, and look again on the next frame. */
  | { kind: 'jump' }
  /** Scroll to the rows rendered (smoothly, a short way, for a move from where the view is), and stop there. */
  | { kind: 'rows'; smooth: boolean }
  /** Put the change's first row in its place (`scrollTop`), and look again on the next frame. */
  | { kind: 'place'; scrollTop: number }
  /** Nothing to do this frame: look again on the next one. */
  | { kind: 'wait' };

/** What the diff shows on a frame, for `changeScrollStep`. */
export interface ChangeScrollFrame {
  why: ChangeScroll;
  /** Where the change's first row starts below the top of the view; null while it isn't rendered. */
  rowOffset: number | null;
  /** How far below the top of the view the change goes: a few rows down, what comes before it in view. */
  placeOffset: number;
  scrollTop: number;
  /** How far the view can scroll (`scrollHeight - clientHeight`). */
  maxScroll: number;
  viewHeight: number;
  /** Whether Pierre can tell where the change is laid out while it isn't rendered (`pierreLinePosition`). */
  canJump: boolean;
}

/** Where scrolling to a change stands, carried from frame to frame. */
export interface ChangeScrollState {
  /** Jumped to where Pierre estimated the change. */
  jumped: boolean;
  /** Frames in a row the change stood in its place, after a jump. */
  settledFrames: number;
}

export const CHANGE_SCROLL_START: ChangeScrollState = { jumped: false, settledFrames: 0 };

/** Frames in a row a change must stand in its place, after a jump, before the rows above it are taken as laid out. */
export const SETTLED_FRAMES = 2;

/** Within this, in pixels, a change stands in its place (scroll positions are fractional on high-density screens). */
const IN_PLACE = 1;

export function changeScrollStep(state: ChangeScrollState, frame: ChangeScrollFrame): { step: ChangeScrollStep; state: ChangeScrollState } {
  if (frame.rowOffset === null) {
    if (!state.jumped && frame.canJump) return { step: { kind: 'jump' }, state: { ...state, jumped: true } };
    return { step: { kind: 'wait' }, state };
  }
  if (!state.jumped) {
    if (frame.why === 'open' && startsInView(frame)) return { step: { kind: 'done' }, state };
    return { step: { kind: 'rows', smooth: frame.why === 'move' }, state };
  }
  const scrollTop = placedScrollTop(frame);
  if (Math.abs(scrollTop - frame.scrollTop) > IN_PLACE) return { step: { kind: 'place', scrollTop }, state: { ...state, settledFrames: 0 } };
  const settledFrames = state.settledFrames + 1;
  return { step: settledFrames >= SETTLED_FRAMES ? { kind: 'done' } : { kind: 'wait' }, state: { ...state, settledFrames } };
}

/** The scroll position that puts the change's first row `placeOffset` below the top, within the ends of the content. */
function placedScrollTop({ rowOffset, placeOffset, scrollTop, maxScroll }: ChangeScrollFrame): number {
  return Math.min(Math.max(0, scrollTop + rowOffset! - placeOffset), Math.max(0, maxScroll));
}

function startsInView({ rowOffset, viewHeight }: ChangeScrollFrame): boolean {
  return rowOffset! >= 0 && rowOffset! < viewHeight;
}
