/**
 * Placing something in a diff that renders only the lines in view (a change stepped to, a link's line), frame by frame:
 * Pierre lays out the rows a scroll brings in a frame or more after it, at their real heights (a wrapped line, taller
 * than estimated), which moves what was just placed. So it's placed again on each frame until it stands in its place
 * on `SETTLED_FRAMES` frames in a row; placed a fixed number of times, a line below wrapped lines stood screens lower.
 * `scrollToAnnotationRow` follows the same rule with its own count, 3: a comment's row grows itself as its card
 * renders, where a line's row doesn't.
 */
export interface SettledPlacement {
  /** Frames in a row it stood in its place. */
  settledFrames: number;
}

export const PLACEMENT_START: SettledPlacement = { settledFrames: 0 };

/** Frames in a row it must stand in its place before the rows above it are taken as laid out. */
export const SETTLED_FRAMES = 2;

/** Within this, in pixels, it stands in its place (scroll positions are fractional on high-density screens). */
const IN_PLACE = 1;

export interface PlacementFrame {
  /** The scroll position that puts it in its place, as laid out this frame. */
  target: number;
  scrollTop: number;
  /** How far the view can scroll (`scrollHeight - clientHeight`). */
  maxScroll: number;
}

export interface PlacementStep {
  /** Where to scroll this frame; none when it stands in its place. */
  scrollTo: number | null;
  done: boolean;
  state: SettledPlacement;
}

export function placementStep(state: SettledPlacement, { target, scrollTop, maxScroll }: PlacementFrame): PlacementStep {
  const within = Math.min(Math.max(0, target), Math.max(0, maxScroll));
  if (Math.abs(within - scrollTop) > IN_PLACE) return { scrollTo: within, done: false, state: { settledFrames: 0 } };
  const settledFrames = state.settledFrames + 1;
  return { scrollTo: null, done: settledFrames >= SETTLED_FRAMES, state: { settledFrames } };
}
