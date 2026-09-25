/** Room a date keeps from the next day's boundary. */
const LABEL_PAD = 6;

/**
 * Where a day's date goes in the ruler: centered in the part of the day that is on screen (so it stays readable
 * while the day scrolls away), but never past the day's right boundary onto the next day's date. When even that
 * doesn't fit, it is cut on the left rather than overlapping.
 */
export function rulerLabelX(dayStart: number, nextDayStart: number, labelWidth: number, canvasWidth: number): number {
  const visibleLeft = Math.max(dayStart, 0);
  const visibleRight = Math.min(nextDayStart, canvasWidth);
  const centered = Math.max((visibleLeft + visibleRight) / 2 - labelWidth / 2, visibleLeft + LABEL_PAD);
  return Math.min(centered, nextDayStart - LABEL_PAD - labelWidth);
}
