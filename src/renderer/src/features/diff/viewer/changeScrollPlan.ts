import type { ChangeScroll } from './changeView';

/**
 * What one frame of scrolling to a change decides (`scrollToChange`), from what the diff shows on that frame
 * (`ChangeScrollFrame`). A change not rendered yet is jumped to where Pierre estimates it, once; once its rows render,
 * they're scrolled to.
 */
export type ChangeScrollStep =
  /** Done: the change is in view as a diff opens. */
  | { kind: 'done' }
  /** Jump to where Pierre lays the change out, and look again on the next frame. */
  | { kind: 'jump' }
  /** Scroll to the rows rendered (smoothly, a short way, for a move from where the view is), and stop there. */
  | { kind: 'rows'; smooth: boolean }
  /** Nothing to do this frame: look again on the next one. */
  | { kind: 'wait' };

/** What the diff shows on a frame, for `changeScrollStep`. */
export interface ChangeScrollFrame {
  why: ChangeScroll;
  /** Where the change's first row starts below the top of the view; null while it isn't rendered. */
  rowOffset: number | null;
  viewHeight: number;
  /** Whether Pierre can tell where the change is laid out while it isn't rendered (`pierreLinePosition`). */
  canJump: boolean;
}

/** Where scrolling to a change stands, carried from frame to frame. */
export interface ChangeScrollState {
  /** Jumped to where Pierre estimated the change. */
  jumped: boolean;
}

export const CHANGE_SCROLL_START: ChangeScrollState = { jumped: false };

export function changeScrollStep(state: ChangeScrollState, frame: ChangeScrollFrame): { step: ChangeScrollStep; state: ChangeScrollState } {
  if (frame.rowOffset === null) {
    if (!state.jumped && frame.canJump) return { step: { kind: 'jump' }, state: { jumped: true } };
    return { step: { kind: 'wait' }, state };
  }
  // Where Pierre estimated it (`jumped`), a row in view may still be a few rows off: set right all the same.
  if (frame.why === 'open' && !state.jumped && startsInView(frame)) return { step: { kind: 'done' }, state };
  return { step: { kind: 'rows', smooth: frame.why === 'move' && !state.jumped }, state };
}

function startsInView({ rowOffset, viewHeight }: ChangeScrollFrame): boolean {
  return rowOffset! >= 0 && rowOffset! < viewHeight;
}
