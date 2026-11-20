/** Watches what may resize, calling back after each layout and before it's painted; returns a function that stops. */
export type ResizeWatch = (onResize: () => void) => () => void;

/**
 * How long the place is held after the change, unless the user moves the view first: what changed lays out over a few
 * renders (Pierre draws a diff anew).
 */
export const HOLD_MS = 800;

/**
 * Keeps something on screen where it is while `change` resizes what's around it (every suggestion shown another way,
 * above it too): its top is read before (`topOf`), and each time anything resizes (`watch`), whatever it moved is
 * scrolled back (`scrollBy`). Corrected after the layout and before the paint (a `ResizeObserver`), so the jump is
 * never seen: correcting on the next frame showed it, then the scroll back, as a flicker.
 */
export function keepInPlace(topOf: () => number, scrollBy: (delta: number) => void, change: () => void, watch: ResizeWatch, release: (stop: () => void) => void): void {
  const before = topOf();
  const putBack = (): void => {
    const moved = topOf() - before;
    if (moved !== 0) scrollBy(moved);
  };
  const stop = watch(putBack);
  change();
  release(stop);
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

/** `keepInPlace` for an element on screen: its scrolling ancestor scrolled, it and the scrolled content watched. */
export function keepElementInPlace(element: Element, change: () => void): void {
  const scroller = scrollingAncestorOf(element);
  if (!scroller) return change();
  const watch: ResizeWatch = (onResize) => {
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    for (const content of scroller.children) observer.observe(content);
    return () => observer.disconnect();
  };
  keepInPlace(() => element.getBoundingClientRect().top, (delta) => (scroller.scrollTop += delta), change, watch, (stop) => releaseOnUserMove(scroller, stop));
}

/** Input that moves the view: the user's own scroll in the hold is theirs, never put back. */
const USER_MOVES = ['wheel', 'keydown', 'pointerdown', 'touchstart'] as const;

/** Stops holding after `HOLD_MS`, or as soon as the user moves the view themselves, whichever comes first. */
function releaseOnUserMove(scroller: Element, stop: () => void): void {
  const timer = setTimeout(release, HOLD_MS);
  for (const kind of USER_MOVES) scroller.addEventListener(kind, release, { capture: true, passive: true });
  function release(): void {
    clearTimeout(timer);
    for (const kind of USER_MOVES) scroller.removeEventListener(kind, release, { capture: true });
    stop();
  }
}
