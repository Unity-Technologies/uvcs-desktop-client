export type HoverOutcome = 'keep' | 'show' | 'hide';

interface Hover<Host> {
  /** The element whose tooltip is on screen, if any. */
  shownHost: Host | null;
  /** The element with a tooltip under the pointer now, if any. */
  hoveredHost: Host | null;
  /** Whether hovering may show a tooltip (`TooltipGate`). */
  allowsHover: boolean;
}

/**
 * What a hover does to the tooltip. The page reports a hover each time the pointer crosses into a child of an element
 * (a button's icon, its label): over the element already showing its tooltip, the tooltip stays where it is rather than
 * showing again at the new pointer position and popping in anew.
 */
export function hoverOutcome<Host>({ shownHost, hoveredHost, allowsHover }: Hover<Host>): HoverOutcome {
  if (!hoveredHost || !allowsHover) return 'hide';
  return hoveredHost === shownHost ? 'keep' : 'show';
}
