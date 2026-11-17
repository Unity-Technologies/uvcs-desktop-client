/** Something to bring into view in a scrolled pane, from the top of its content: a commented line and its card. */
export interface Placed {
  /** Where it starts: the commented line, or a card. */
  top: number;
  /** Where what goes with it ends: the line's card, or the card itself. */
  bottom: number;
}

/**
 * Where to scroll a pane so a commented line and its card read with context (a comment gone to in the code, opened in
 * the context dialog): the line a third of the way down, lines of context above it, its card below. A card taller
 * than the room below scrolls on just enough to fit, keeping `contextAbove` above the line (the card cut instead);
 * a line near the top stays at the top, one near the end stops at the end.
 */
export function focusScrollTop({ top, bottom, contextAbove, viewHeight, contentHeight }: Placed & { contextAbove: number; viewHeight: number; contentHeight: number }): number {
  let scrollTop = top - viewHeight / 3;
  if (bottom - scrollTop > viewHeight) scrollTop = Math.min(bottom - viewHeight, top - contextAbove);
  return clampScrollTop(scrollTop, viewHeight, contentHeight);
}

function clampScrollTop(scrollTop: number, viewHeight: number, contentHeight: number): number {
  return Math.max(0, Math.min(scrollTop, contentHeight - viewHeight));
}

/**
 * Where to scroll a list so a card gone to shows (the Comments panel's, stepping with N): nowhere when it shows whole
 * already; else its top a third of the way down, a card taller than the room below kept whole, one taller than the
 * view from its top; the list's start and end never passed.
 */
export function listScrollTop(card: Placed, view: { scrollTop: number; height: number; contentHeight: number }): number | null {
  if (card.top >= view.scrollTop && card.bottom <= view.scrollTop + view.height) return null;
  let scrollTop = card.top - view.height / 3;
  if (card.bottom - scrollTop > view.height) scrollTop = Math.min(card.bottom - view.height, card.top);
  return clampScrollTop(scrollTop, view.height, view.contentHeight);
}

/**
 * Brings an element into view the way every navigation to a thing does (a thread, a comment, a section): its top a third
 * down the viewport, so it reads with what follows it, even when it was already on screen. Only the scroll range's ends
 * stop it short. An element taller than the viewport shows its top. `behavior` is `smooth` for a glide, `auto` at once.
 */
export function placeInView(element: HTMLElement, behavior: ScrollBehavior): void {
  const container = scrollingParentOf(element);
  const isDocument = container === document.scrollingElement;
  const containerTop = isDocument ? 0 : container.getBoundingClientRect().top;
  const box = element.getBoundingClientRect();
  const top = box.top - containerTop + container.scrollTop;
  const viewHeight = isDocument ? window.innerHeight : container.clientHeight;
  // Nothing above it is kept: `contextAbove` 0 puts the element's top, not the lines before it, a third down.
  const scrollTop = focusScrollTop({ top, bottom: top + box.height, contextAbove: 0, viewHeight, contentHeight: container.scrollHeight });
  container.scrollTo({ top: scrollTop, behavior });
}

/** The nearest ancestor that scrolls its content, or the document when none does. */
function scrollingParentOf(element: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return document.scrollingElement as HTMLElement;
}
