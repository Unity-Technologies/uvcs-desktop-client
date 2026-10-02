/** Which parts of a folded comment (`FoldedComment`) don't fit while folded. */
export interface FoldedCut {
  title: boolean;
  description: boolean;
}

/**
 * The scroll overflow under which an element counts as whole: line heights round to fractional pixels, so a block that
 * fits can still scroll by a pixel or two.
 */
const ROUNDING_SLACK_PX = 2;

/** Whether an element's content runs past its clamped height. */
export function isCut(element: { scrollHeight: number; clientHeight: number } | null): boolean {
  return Boolean(element && element.scrollHeight - element.clientHeight > ROUNDING_SLACK_PX);
}

/**
 * What is cut once measured again. A part found cut stays cut: once expanded nothing overflows, yet "Show less" must
 * stay. Gives back `current` itself when nothing changed, so a resize that changes nothing doesn't render again.
 */
export function foldedCut(current: FoldedCut, measured: FoldedCut): FoldedCut {
  const next = { title: current.title || measured.title, description: current.description || measured.description };
  return next.title === current.title && next.description === current.description ? current : next;
}
