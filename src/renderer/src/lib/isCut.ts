/**
 * The scroll overflow under which an element counts as whole: line heights round to fractional pixels, so a block that
 * fits can still scroll by a pixel or two.
 */
const ROUNDING_SLACK_PX = 2;

/** Whether an element's content runs past its clamped height. */
export function isCut(element: { scrollHeight: number; clientHeight: number } | null): boolean {
  return Boolean(element && element.scrollHeight - element.clientHeight > ROUNDING_SLACK_PX);
}
