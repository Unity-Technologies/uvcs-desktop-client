// What the smoke test checks after every step (scripts/e2e/README.md "Cut-off focus rings"): the keyboard's focus ring
// around every control shown is whole. A ring drawn outside its control (`--focus-ring-visible`, an outline) is cut
// where a box around it clips (`overflow` other than `visible`) and doesn't leave room for it: the sidebar's rows and
// the fold button of a review comment in the code showed rings cut on a side. Rows and panes draw theirs inside
// (`--focus-ring-inset`, docs/architecture/renderer.md "Focus"), which nothing clips.
//
// Each control is styled as if the keyboard had focused it (`CSS.forcePseudoState`, `:focus-visible`), all at once:
// focusing them for real would run the app's focus handlers (a row selected, a thread picked) and move the page.
// A ring paints over the layout and never moves it, so forcing every control together measures each one's alone.

/** Smaller cuts are rounding. */
const TOLERANCE_PX = 0.5;

/** Marks every control shown that the keyboard can reach with Tab, `data-ring-probe`, and keeps how each draws at rest. */
function markControls() {
  const reachable =
    'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  const controls = [];
  const visit = (root) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visit(element.shadowRoot);
      // What screen readers alone read is clipped to a pixel on purpose (`.visually-hidden`).
      if (!element.matches(reachable) || element.closest('[inert], [aria-hidden="true"], .visually-hidden')) continue;
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      controls.push(element);
    }
  };
  visit(document);
  controls.forEach((element, index) => {
    element.setAttribute('data-ring-probe', String(index));
    const style = getComputedStyle(element);
    element.ringProbeAtRest = `${style.boxShadow}|${style.outlineStyle}|${style.outlineWidth}|${style.outlineOffset}`;
  });
  return controls.length;
}

/**
 * Runs in the page with every marked control styled as focused: each whose ring, where it differs from the control's
 * look at rest, reaches past a box clipping it, as `<what>: its ring is cut <n>px on its <side> by <what clips it>`.
 * Only what the control could show whole: a control itself cut by the box (scrolled partly away, a cell's ellipsis)
 * is left alone on that side. `allowed` is a CSS selector for what may be (`CLIPPED_RING_ALLOWED`), or ''.
 */
function measureRings({ allowed, tolerance }) {
  const describe = (element) => {
    if (!element) return 'the window';
    const label = element.getAttribute('aria-label') ?? element.getAttribute('role') ?? element.textContent?.trim().slice(0, 30);
    const firstClass = (element.getAttribute('class') ?? '').split(' ')[0];
    return `<${element.tagName.toLowerCase()}${firstClass ? ` .${firstClass}` : ''}${label ? ` "${label}"` : ''}>`;
  };
  /** How far the focus ring reaches past the control's border box on each side, 0 where it doesn't. */
  const ringReach = (style) => {
    const reach = { top: 0, right: 0, bottom: 0, left: 0 };
    // Computed shadows read `<color> <x> <y> <blur> <spread> [inset]`, comma-separated, with commas inside rgb() too.
    for (const shadow of style.boxShadow === 'none' ? [] : style.boxShadow.split(/,(?![^(]*\))/)) {
      if (/\binset\b/.test(shadow) || /rgba\([^)]*,\s*0\)|transparent/.test(shadow)) continue;
      const [x = 0, y = 0, blur = 0, spread = 0] = [...shadow.replace(/rgba?\([^)]*\)/, '').matchAll(/-?[\d.]+px/g)].map((match) => parseFloat(match[0]));
      reach.top = Math.max(reach.top, spread + blur - y);
      reach.bottom = Math.max(reach.bottom, spread + blur + y);
      reach.left = Math.max(reach.left, spread + blur - x);
      reach.right = Math.max(reach.right, spread + blur + x);
    }
    if (style.outlineStyle !== 'none') {
      const outline = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      for (const side of Object.keys(reach)) reach[side] = Math.max(reach[side], outline);
    }
    return reach;
  };
  /** The parent in the tree as laid out: a slotted element's slot, a shadow root's host. */
  const parentOf = (element) => element.assignedSlot ?? element.parentElement ?? (element.getRootNode() instanceof ShadowRoot ? element.getRootNode().host : null);
  /**
   * The boxes clipping the element, nearest first, each with the edges it clips at: its padding box, or where its
   * content ends along an axis it scrolls, as far as the control can be scrolled to. The window last.
   */
  const clippersOf = (element) => {
    const clippers = [];
    // An absolutely placed box escapes the clip of every box between it and the one it's placed in; a fixed one, all.
    let escapesUntil = getComputedStyle(element).position === 'absolute' ? element.offsetParent : null;
    let fixed = getComputedStyle(element).position === 'fixed';
    for (let ancestor = parentOf(element); ancestor && ancestor !== document.documentElement && !fixed; ancestor = parentOf(ancestor)) {
      const style = getComputedStyle(ancestor);
      const escaped = escapesUntil !== null && ancestor !== escapesUntil;
      if (ancestor === escapesUntil) escapesUntil = null;
      if (!escaped && (style.overflowX !== 'visible' || style.overflowY !== 'visible')) {
        const box = ancestor.getBoundingClientRect();
        const left = box.left + ancestor.clientLeft;
        const top = box.top + ancestor.clientTop;
        const scrollsX = /auto|scroll/.test(style.overflowX);
        const scrollsY = /auto|scroll/.test(style.overflowY);
        clippers.push({
          element: ancestor,
          clipsX: style.overflowX !== 'visible',
          clipsY: style.overflowY !== 'visible',
          left: scrollsX ? left - ancestor.scrollLeft : left,
          right: scrollsX ? left - ancestor.scrollLeft + ancestor.scrollWidth : left + ancestor.clientWidth,
          top: scrollsY ? top - ancestor.scrollTop : top,
          bottom: scrollsY ? top - ancestor.scrollTop + ancestor.scrollHeight : top + ancestor.clientHeight,
        });
      }
      const position = style.position;
      if (position === 'fixed') fixed = true;
      if (position === 'absolute' && escapesUntil === null && !escaped) escapesUntil = ancestor.offsetParent;
    }
    clippers.push({ element: null, clipsX: true, clipsY: true, left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight });
    return clippers;
  };

  const found = [];
  let ringed = 0;
  // Shadow roots (the code's, Pierre's) hold controls too.
  const visit = (root) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visit(element.shadowRoot);
      if (element.hasAttribute('data-ring-probe')) found.push(...cutsOf(element));
    }
  };
  visit(document);
  return { found, ringed };

  function cutsOf(element) {
    if (allowed && element.closest(allowed)) return [];
    const style = getComputedStyle(element);
    const focused = `${style.boxShadow}|${style.outlineStyle}|${style.outlineWidth}|${style.outlineOffset}`;
    if (focused === element.ringProbeAtRest) return [];
    ringed += 1;
    const reach = ringReach(style);
    if (Object.values(reach).every((distance) => distance <= 0)) return [];
    const box = element.getBoundingClientRect();
    const cuts = [];
    for (const clipper of clippersOf(element)) {
      const sides = [
        ['left', clipper.clipsX, clipper.left - (box.left - reach.left), box.left >= clipper.left - tolerance],
        ['right', clipper.clipsX, box.right + reach.right - clipper.right, box.right <= clipper.right + tolerance],
        ['top', clipper.clipsY, clipper.top - (box.top - reach.top), box.top >= clipper.top - tolerance],
        ['bottom', clipper.clipsY, box.bottom + reach.bottom - clipper.bottom, box.bottom <= clipper.bottom + tolerance],
      ];
      for (const [side, clips, cut, controlWhole] of sides) {
        if (clips && controlWhole && reach[side] > 0 && cut > tolerance) {
          cuts.push(`${describe(element)}: its ring is cut ${Math.round(cut * 10) / 10}px on its ${side} by ${describe(clipper.element)}`);
        }
      }
      if (cuts.length > 0) break;
    }
    return cuts;
  }
}

/** Takes the marks off. */
function unmarkControls() {
  const visit = (root) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visit(element.shadowRoot);
      if (element.hasAttribute('data-ring-probe')) {
        element.removeAttribute('data-ring-probe');
        delete element.ringProbeAtRest;
      }
    }
  };
  visit(document);
}

/** The node ids of the marked controls, in the light tree and in every shadow root. */
function markedNodeIds(node, ids = []) {
  const attributes = node.attributes ?? [];
  for (let index = 0; index < attributes.length; index += 2) if (attributes[index] === 'data-ring-probe') ids.push(node.nodeId);
  for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) markedNodeIds(child, ids);
  return ids;
}

/** One DevTools session per window, its DOM and CSS agents on: enabling them costs more than the check itself. */
const sessions = new WeakMap();

async function sessionOf(page) {
  if (!sessions.has(page)) {
    sessions.set(
      page,
      (async () => {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        return cdp;
      })(),
    );
  }
  return sessions.get(page);
}

/**
 * Every control in `page` whose keyboard focus ring would be cut off, one line each (`measureRings`). `allowed` lists
 * what may be, each with why (`CLIPPED_RING_ALLOWED` in smoke.mjs).
 */
export async function findClippedFocusRings(page, allowed) {
  try {
    if ((await page.evaluate(markControls)) === 0) return [];
    const cdp = await sessionOf(page);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const ids = markedNodeIds(root);
    // A control the app took away meanwhile (a toast gone) is no longer shown: its node is unknown, and it's left out.
    const forced = await Promise.allSettled(ids.map((nodeId) => cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus-visible'] })));
    const { found, ringed } = await page.evaluate(measureRings, { allowed: allowed.map(({ selector }) => selector).join(', '), tolerance: TOLERANCE_PX });
    // Forcing that styles nothing would pass every step having checked nothing: a window shows some control with a ring.
    if (!forced.some(({ status }) => status === 'fulfilled') || ringed === 0) {
      throw new Error(`the focus ring check styled none of the ${ids.length} controls shown as focused: CSS.forcePseudoState no longer works as it did`);
    }
    await Promise.allSettled(ids.map((nodeId) => cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })));
    return found;
  } finally {
    await page.evaluate(unmarkControls).catch(() => {});
  }
}
