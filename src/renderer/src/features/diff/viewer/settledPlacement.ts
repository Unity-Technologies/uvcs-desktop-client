/**
 * Placing something in a diff that renders only the lines in view (a change stepped to, a link's line), frame by frame:
 * Pierre lays out the rows a scroll brings in a frame or more after it, at their real heights (a wrapped line, taller
 * than estimated), which moves what was just placed. So it's placed again whenever its place moved, until its place
 * stood still on `SETTLED_FRAMES` frames in a row; placed a fixed number of times, a line below wrapped lines stood
 * screens lower. Its place, not the view, is what's watched: a scroll of the user's while it settles leaves the view
 * where the user took it. `scrollToAnnotationRow` follows the same rule with its own count: a comment's row grows
 * itself as its card renders, where a line's doesn't.
 */
export interface SettledPlacement {
  /** The scroll position last aimed at; none before the first. */
  aimedAt: number | null;
  /** Frames in a row the place stood where it was aimed at. */
  settledFrames: number;
}

export const PLACEMENT_START: SettledPlacement = { aimedAt: null, settledFrames: 0 };

/** Frames in a row the place must stand still before the rows above it are taken as laid out. */
export const SETTLED_FRAMES = 2;

/** Within this, in pixels, the place stood still (scroll positions are fractional on high-density screens). */
const IN_PLACE = 1;

export interface PlacementFrame {
  /** The scroll position that puts it in its place, as laid out this frame. */
  target: number;
  /** How far the view can scroll (`scrollHeight - clientHeight`). */
  maxScroll: number;
}

export interface PlacementStep {
  /** Where to scroll this frame; none when its place stood still. */
  scrollTo: number | null;
  done: boolean;
  state: SettledPlacement;
}

export function placementStep(state: SettledPlacement, { target, maxScroll }: PlacementFrame): PlacementStep {
  const within = Math.min(Math.max(0, target), Math.max(0, maxScroll));
  if (state.aimedAt === null || Math.abs(within - state.aimedAt) > IN_PLACE) {
    return { scrollTo: within, done: false, state: { aimedAt: within, settledFrames: 0 } };
  }
  const settledFrames = state.settledFrames + 1;
  return { scrollTo: null, done: settledFrames >= SETTLED_FRAMES, state: { ...state, settledFrames } };
}
