import { PLACEMENT_START, placementStep, type SettledPlacement } from './settledPlacement';

/**
 * What one frame of scrolling to a change decides (`scrollToChange`), from what the diff shows on that frame
 * (`ChangeScrollFrame`). A change not rendered yet is jumped to where Pierre estimates it, once; once its rows render,
 * they're scrolled to. After a jump, the rows above it render on the frames that follow at their real heights, which
 * moves it again: so it's placed until it stands still (`placementStep`). Placed once only, a change below wrapped
 * lines stood 1700 px lower, out of view.
 */
/**
 * Why a change is scrolled to: a move to it (a short way smoothly, unless it's all in view), or the diff opening on it
 * (at once, unless it starts in view: a collapsed diff's first hunk, taller than the view, keeps the bar above it).
 */
export type ChangeScroll = 'move' | 'open';

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
  /** Placing the change, after a jump. */
  placement: SettledPlacement;
}

export const CHANGE_SCROLL_START: ChangeScrollState = { jumped: false, placement: PLACEMENT_START };

export function changeScrollStep(state: ChangeScrollState, frame: ChangeScrollFrame): { step: ChangeScrollStep; state: ChangeScrollState } {
  if (frame.rowOffset === null) {
    if (!state.jumped && frame.canJump) return { step: { kind: 'jump' }, state: { ...state, jumped: true } };
    return { step: { kind: 'wait' }, state };
  }
  if (!state.jumped) {
    if (frame.why === 'open' && startsInView(frame)) return { step: { kind: 'done' }, state };
    return { step: { kind: 'rows', smooth: frame.why === 'move' }, state };
  }
  const { rowOffset, placeOffset, scrollTop, maxScroll } = frame;
  const placed = placementStep(state.placement, { target: scrollTop + rowOffset - placeOffset, maxScroll });
  const step: ChangeScrollStep = placed.scrollTo !== null ? { kind: 'place', scrollTop: placed.scrollTo } : placed.done ? { kind: 'done' } : { kind: 'wait' };
  return { step, state: { ...state, placement: placed.state } };
}

function startsInView({ rowOffset, viewHeight }: ChangeScrollFrame): boolean {
  return rowOffset! >= 0 && rowOffset! < viewHeight;
}
