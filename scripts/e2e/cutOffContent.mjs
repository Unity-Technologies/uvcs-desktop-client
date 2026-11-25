// What the smoke test checks after every step (scripts/e2e/README.md "Cut-off content"): nothing shown in a window's
// page or a dialog is cut off where nothing scrolls. A box that ends past the nearest box clipping it (or the window),
// where that box doesn't scroll, can't be read to its end. A page's frame without `min-height: 0` once grew past the
// window this way, and neither the merge page's list nor its diff scrolled.

/** Smaller differences are rounding and borders, never content out of reach. */
const TOLERANCE_PX = 2;

/**
 * Runs in the page: each box shown that ends below the nearest box clipping it (`overflow-y` other than `visible`), or
 * below the window when none does, where that box doesn't scroll, as `<what> ends <n>px below <what clips it>`. Only
 * downwards: sideways, the app cuts text on purpose (a cell's or a comment's ellipsis, its whole text a hover away).
 * `allowed` is a CSS selector for what may (`CUT_OFF_ALLOWED`), or ''; `loading`, one for what is still loading
 * (`LOADING` in smoke.mjs).
 * The smoke test runs with reduced motion, so the app's own animations last no time; any other one still running on
 * what is checked is waited for (it moves a box while it runs). Loops (spinners) and countdowns elsewhere (a toast's)
 * aren't. Self-contained: Playwright sends its source to the page.
 */
export async function findCutOffContent({ allowed, loading, tolerance }) {
  const checked = 'main, [role="dialog"]';
  const moving = document
    .getAnimations()
    .filter((animation) => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity)
    .filter((animation) => animation.effect?.target instanceof Element && animation.effect.target.closest(checked));
  await Promise.all(moving.map((animation) => animation.finished.catch(() => {})));

  const describe = (element) => {
    if (!element) return 'the window';
    const label = element.getAttribute('aria-label') ?? element.getAttribute('role');
    const firstClass = (element.getAttribute('class') ?? '').split(' ')[0];
    return `<${element.tagName.toLowerCase()}${firstClass ? ` .${firstClass}` : ''}${label ? ` "${label}"` : ''}>`;
  };
  /**
   * The nearest ancestor clipping the element downwards (its `overflow-y` isn't `visible`), or none: the window clips
   * it. A fixed box escapes its ancestors' overflow, so what it holds is clipped by it or by the window, never above.
   */
  const clipperOf = (element) => {
    for (let ancestor = element.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.overflowY !== 'visible') return ancestor;
      if (style.position === 'fixed') return null;
    }
    return null;
  };
  const scrolls = (clipper) => clipper !== null && /auto|scroll/.test(getComputedStyle(clipper).overflowY);

  const found = [];
  for (const element of document.querySelectorAll('main, main *, [role="dialog"], [role="dialog"] *')) {
    // A placeholder fills its box with skeleton rows, cut where the box ends: what loads replaces it.
    if ((allowed && element.closest(allowed)) || element.closest(loading)) continue;
    // Read by screen readers only: clipped to a pixel on purpose.
    if (element.closest('.visually-hidden')) continue;
    const style = getComputedStyle(element);
    // Placed by hand (a virtual list's rows, a popover), not by the layout that should hold it.
    if (style.position === 'absolute' || style.position === 'fixed' || style.display === 'contents') continue;
    if (!element.checkVisibility()) continue;
    const clipper = clipperOf(element);
    if (scrolls(clipper)) continue;
    // Where layout ends it: a negative margin lets a box overhang on purpose (Settings' pane, room for focus rings).
    const end = element.getBoundingClientRect().bottom + Math.min(0, parseFloat(style.marginBottom) || 0);
    const past = end - (clipper ? clipper.getBoundingClientRect().bottom : window.innerHeight);
    if (past > tolerance) found.push(`${describe(element)} ends ${Math.round(past)}px below ${describe(clipper)}`);
  }
  return found;
}

/** The check's arguments: what may be cut off and what is loading, each as one selector. */
export function cutOffArguments(allowed, loading) {
  return { allowed: allowed.map(({ selector }) => selector).join(', '), loading, tolerance: TOLERANCE_PX };
}
