/**
 * The Timeline strip's measurements, in screen px from its top, as the approved design draws them. From top to bottom:
 * the search hits' ticks along the top edge, the activity curve standing on the baseline (the frame around both), the
 * label ticks hanging under it, then the axis's dates.
 */
import { HOME_BADGE_SHADOW, homeBadgeRing } from '../canvas/drawHomeMarker';

export const TIMELINE_HEIGHT = 68;
/** The search hits' ticks, along the top edge: from `HIT_TICK_TOP`, `HIT_TICK_HEIGHT` tall. */
export const HIT_TICK_TOP = 1;
export const HIT_TICK_HEIGHT = 6;
/** Where the curve may reach at its highest. */
export const PLOT_TOP = 8;
/** The line the curve stands on. */
export const BASELINE = 40;
export const PLOT_HEIGHT = BASELINE - PLOT_TOP;
/**
 * A label's tick under the baseline, and a little taller (from a px higher) where several merged into one: a notch
 * bigger than the mockup's 1.5 × 5 and 7 px, which read too small in the app's window.
 */
export const LABEL_TICK_WIDTH = 2;
export const LABEL_TICK_TOP = 43;
export const LABEL_TICK_HEIGHT = 6;
export const MERGED_LABEL_TICK_TOP = 42;
export const MERGED_LABEL_TICK_HEIGHT = 8;
/** The axis's dates: a hairline at each day or month start from `AXIS_TOP`, the date in a line `AXIS_LINE_HEIGHT` tall. */
export const AXIS_TOP = 52;
export const AXIS_LINE_HEIGHT = 14;
export const AXIS_TEXT_MIDDLE = AXIS_TOP + AXIS_LINE_HEIGHT / 2;
/** The frame (the viewport): a rounded box from `FRAME_TOP`, `FRAME_HEIGHT` tall, around the curve and its baseline. */
export const FRAME_TOP = 2;
export const FRAME_HEIGHT = 42;
/** The house: the graph's home badge at 18 px (`drawHomeBadge`). */
export const HOUSE_RADIUS = 9;
/** How far the house reaches from its middle: its disc, half its ring and its shadow. */
export const HOUSE_REACH = HOUSE_RADIUS + homeBadgeRing(HOUSE_RADIUS) / 2 + HOME_BADGE_SHADOW.blur + HOME_BADGE_SHADOW.offsetY;
