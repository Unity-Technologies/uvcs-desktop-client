// What the smoke test checks after every step (scripts/e2e/README.md "Cut-off content"): nothing shown in the window's
// page or a dialog is cut off where nothing scrolls. A box taller than the box holding it, inside one that doesn't
// scroll, spills out of it or is clipped: its end can't be reached. A page's frame without `min-height: 0` once grew
// past the window this way, and neither the merge page's list nor its diff scrolled.

/** Smaller differences are rounding and borders, never content out of reach. */
const TOLERANCE_PX = 2;

/**
 * Runs in the page: each box shown that ends below the box holding it, where that box doesn't scroll, as
 * `<what> ends <n>px below <what holds it>`. `allowed` is a CSS selector for what may (`CUT_OFF_ALLOWED`), or '';
 * `loading`, one for what is still loading (`LOADING` in smoke.mjs).
 * The smoke test runs with reduced motion, so the app's own animations last no time; any other that ends is waited
 * for (one moves a box while it runs), and loops (spinners) are ignored.
 * Self-contained: Playwright sends its source to the page.
 */
export async function findCutOffContent({ allowed, loading, tolerance }) {
  const ending = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.all(ending.map((animation) => animation.finished.catch(() => {})));

  const describe = (element) => {
    const label = element.getAttribute('aria-label') ?? element.getAttribute('role');
    const firstClass = String(element.className).split(' ')[0];
    return `<${element.tagName.toLowerCase()}${firstClass ? ` .${firstClass}` : ''}${label ? ` "${label}"` : ''}>`;
  };
  /** The nearest box holding the element: one with `display: contents` lays its children out as if it weren't there. */
  const holderOf = (element) => {
    let holder = element.parentElement;
    while (holder && getComputedStyle(holder).display === 'contents') holder = holder.parentElement;
    return holder;
  };
  const scrolls = (style) => /auto|scroll/.test(style.overflowY);

  const found = [];
  for (const element of document.querySelectorAll('main *, [role="dialog"] *')) {
    // A placeholder fills its box with skeleton rows, cut where the box ends: what loads replaces it.
    if ((allowed && element.closest(allowed)) || element.closest(loading)) continue;
    const style = getComputedStyle(element);
    if (style.position === 'absolute' || style.position === 'fixed' || style.display === 'contents') continue;
    if (!element.checkVisibility()) continue;
    const holder = holderOf(element);
    if (!holder) continue;
    const holderStyle = getComputedStyle(holder);
    // A box that scrolls lets its end be reached; an inline one (a span in a title) is as tall as its line, not a container.
    if (scrolls(holderStyle) || holderStyle.display.startsWith('inline')) continue;
    const holderBox = holder.getBoundingClientRect();
    // Read by screen readers only (`.visually-hidden`): a 1px box holds it on purpose.
    if (holderBox.width <= 1 || holderBox.height <= 1) continue;
    // Where layout ends it: a negative margin lets a box overhang its holder on purpose (room for focus rings).
    const end = element.getBoundingClientRect().bottom + Math.min(0, parseFloat(style.marginBottom) || 0);
    const past = end - holderBox.bottom;
    if (past > tolerance) found.push(`${describe(element)} ends ${Math.round(past)}px below ${describe(holder)}`);
  }
  return found;
}

/** The check's arguments: what may be cut off and what is loading, each as one selector. */
export function cutOffArguments(allowed, loading) {
  return { allowed: allowed.map(({ selector }) => selector).join(', '), loading, tolerance: TOLERANCE_PX };
}
