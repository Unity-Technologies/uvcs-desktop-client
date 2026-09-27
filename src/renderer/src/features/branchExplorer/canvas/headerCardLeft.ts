/**
 * Where a branch's header card starts (world x). On the start of its band; while that start is scrolled away, pinned
 * to the left edge (`pinnedLeft`) for as long as any of the band shows, so a branch on screen always shows its whole
 * name. Only the next branch on its row (`rightLimit`, where the card must end) pushes it off the edge.
 */
export function headerCardLeft(bandLeft: number, width: number, pinnedLeft: number, rightLimit: number): number {
  return Math.max(bandLeft, Math.min(pinnedLeft, rightLimit - width));
}
