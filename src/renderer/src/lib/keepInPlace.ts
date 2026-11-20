/** Where a frame's work is asked for: the window's animation frames, or a test's. */
export type RequestFrame = (run: () => void) => unknown;

/** Frames the place is held for: what changed may lay out over a few (Pierre draws a diff anew in a frame of its own). */
export const HELD_FRAMES = 12;

/**
 * Keeps something on screen where it is while `change` resizes what's around it (a suggestion's box shown another
 * way): its top is read before (`topOf`), and for the next few frames whatever it moved is scrolled back (`scrollBy`),
 * so the eye stays on it rather than on a jump.
 */
export function keepInPlace(topOf: () => number, scrollBy: (delta: number) => void, change: () => void, requestFrame: RequestFrame, frames = HELD_FRAMES): void {
  const before = topOf();
  change();
  let left = frames;
  const hold = (): void => {
    const moved = topOf() - before;
    if (moved !== 0) scrollBy(moved);
    if (--left > 0) requestFrame(hold);
  };
  requestFrame(hold);
}

/**
 * The element scrolling `element`: the nearest ancestor that scrolls up and down, across the shadow roots on the way
 * (Pierre draws a diff, and a thread in it, in one). None when nothing scrolls it.
 */
export function scrollingAncestorOf(element: Element): Element | null {
  let current: Element | null = parentAcrossShadows(element);
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) return current;
    current = parentAcrossShadows(current);
  }
  return null;
}

function parentAcrossShadows(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/** `keepInPlace` for an element on screen, its scrolling ancestor scrolled. */
export function keepElementInPlace(element: Element, change: () => void): void {
  const scroller = scrollingAncestorOf(element);
  if (!scroller) return change();
  keepInPlace(() => element.getBoundingClientRect().top, (delta) => scroller.scrollBy({ top: delta }), change, requestAnimationFrame);
}
