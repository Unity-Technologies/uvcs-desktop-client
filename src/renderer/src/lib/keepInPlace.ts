/** Watches what may resize, calling back after each layout and before it's painted; returns a function that stops. */
export type ResizeWatch = (onResize: () => void) => () => void;

/** How long the place is held after the change: what changed lays out over a few renders (Pierre draws a diff anew). */
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
  keepInPlace(() => element.getBoundingClientRect().top, (delta) => (scroller.scrollTop += delta), change, watch, (stop) => setTimeout(stop, HOLD_MS));
}
