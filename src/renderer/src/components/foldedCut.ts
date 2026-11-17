/** Which parts of a folded comment (`FoldedComment`) don't fit while folded. */
export interface FoldedCut {
  title: boolean;
  description: boolean;
}

/**
 * What is cut once measured again. A part found cut stays cut: once expanded nothing overflows, yet "Show less" must
 * stay. Gives back `current` itself when nothing changed, so a resize that changes nothing doesn't render again.
 */
export function foldedCut(current: FoldedCut, measured: FoldedCut): FoldedCut {
  const next = { title: current.title || measured.title, description: current.description || measured.description };
  return next.title === current.title && next.description === current.description ? current : next;
}
