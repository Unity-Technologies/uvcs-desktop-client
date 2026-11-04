/**
 * The Timeline strip's measurements, in screen px from its top. From top to bottom: the search hits' ticks along the
 * top edge, the activity curve standing on the baseline, the label ticks hanging under it, then the axis's dates.
 */
export const TIMELINE_HEIGHT = 68;
/** The search hits' ticks, along the top edge. */
export const HIT_TICK_HEIGHT = 4;
/** Where the curve may reach at its highest. */
export const PLOT_TOP = 8;
/** The line the curve stands on. */
export const BASELINE = 46;
export const PLOT_HEIGHT = BASELINE - PLOT_TOP;
/** A label's tick under the baseline, and a little taller where several merged into one. */
export const LABEL_TICK_HEIGHT = 5;
export const MERGED_LABEL_TICK_HEIGHT = 8;
/** The middle of the axis's dates. */
export const AXIS_TEXT_MIDDLE = 60;
