/** How long the pointer rests on an anchor before its hover card shows. */
export const HOVER_OPEN_DELAY_MS = 350;

/** How long a card the pointer can reach stays once the pointer leaves: time to cross the gap onto it. */
export const HOVER_CLOSE_DELAY_MS = 200;

/** What happens to a hover card (`useHoverOpen`) on the pointer or the focus. */
export type HoverEvent = 'enterAnchor' | 'leaveAnchor' | 'enterCard' | 'leaveCard' | 'focus' | 'blur';

/** Open or close it now, later (a pending step replaced by the next), or leave it as it is (a pending step dropped). */
export type HoverStep = { open: boolean; afterMs: number } | { keep: true };

interface HoverContext {
  /** A card the pointer can move onto, to scroll it and select its text: a long attribute value. */
  scrollable: boolean;
  /** The pointer is over the card. */
  overCard: boolean;
}

/**
 * A hover card shows after the pointer rests on its anchor, at once on keyboard focus, and goes as either leaves. One
 * that scrolls stays while the pointer crosses onto it and rests there, and a press in it (selecting its text), which
 * takes the anchor's focus, keeps it.
 */
export function hoverStep(event: HoverEvent, { scrollable, overCard }: HoverContext): HoverStep {
  switch (event) {
    case 'enterAnchor':
      return { open: true, afterMs: HOVER_OPEN_DELAY_MS };
    case 'focus':
      return { open: true, afterMs: 0 };
    case 'leaveAnchor':
    case 'leaveCard':
      return { open: false, afterMs: scrollable ? HOVER_CLOSE_DELAY_MS : 0 };
    case 'enterCard':
      return { keep: true };
    case 'blur':
      return scrollable && overCard ? { keep: true } : { open: false, afterMs: 0 };
  }
}
