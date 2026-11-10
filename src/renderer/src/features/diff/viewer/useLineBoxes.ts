import { useEffect, useState, type RefObject } from 'react';
import type { ChangedLine } from './changeBlocks';
import { lineNumberCellSelector, paneContentSelector, topRowOf, type CodeLayout } from './lineActions';
import { paneRect, pierreShadowRoot } from './pierreDom';

/** Where a line is, in the container's scrolled content: its row's top and bottom, and its pane's code's left and right edges. */
export interface LineBox {
  top: number;
  bottom: number;
  contentLeft: number;
  paneRight: number;
}

/** Frames to wait for the lines' rows to render. */
const MAX_FRAMES = 60;

/**
 * Where each of `lines` is drawn, by its key, to place something by it (a chip, a marker) in the container's scrolled
 * content: only the lines whose rows are rendered (a big file renders only the lines in view), measured again as the
 * view scrolls, or it or its content resizes. `linesKey` names the lines, so a new array of the same lines measures nothing anew.
 */
export function useLineBoxes(containerRef: RefObject<HTMLElement | null>, lines: readonly (ChangedLine & { key: string })[], linesKey: string, layout: CodeLayout): ReadonlyMap<string, LineBox> {
  const [boxes, setBoxes] = useState<ReadonlyMap<string, LineBox>>(NO_BOXES);

  // After the commit, not in a layout effect: what is placed is inside the container, whose ref is set after its
  // children's layout effects run.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || lines.length === 0) return setBoxes(NO_BOXES);
    // The container's size, and its content's: rows growing above a line (a thread opened, a region unfolded) move it.
    const resize = new ResizeObserver(() => void measure());
    /** Measures every line rendered; false while none of them is. */
    const measure = (): boolean => {
      const root = pierreShadowRoot(container);
      // The code panes too: Pierre's host is at least as tall as the view, so in a short file a row added above the
      // code (outdated comments) moves the lines without resizing the host. Observing a pane again does nothing.
      for (const pane of root?.querySelectorAll('[data-code]') ?? []) resize.observe(pane);
      const view = container.getBoundingClientRect();
      const next = new Map<string, LineBox>();
      for (const line of lines) {
        // Above the code (`lineNumber: 0`): its first row, whichever it is.
        const cell = line.lineNumber < 1 ? topRowIn(root, line, layout) : root?.querySelector(lineNumberCellSelector(line, layout));
        const pane = cell?.closest('[data-code]');
        if (!cell || !pane) continue;
        const rect = cell.getBoundingClientRect();
        const content = pane.querySelector(':scope > [data-content]')?.getBoundingClientRect();
        next.set(line.key, {
          top: rect.top - view.top + container.scrollTop,
          bottom: rect.bottom - view.top + container.scrollTop,
          contentLeft: (content?.left ?? rect.right) - view.left + container.scrollLeft,
          paneRight: paneRect(pane).right - view.left + container.scrollLeft,
        });
      }
      setBoxes((last) => (sameBoxes(last, next) ? last : next));
      return next.size > 0;
    };
    // The code may not be rendered yet (it highlights, or scrolls to a link's lines): look again for a moment.
    let frames = 0;
    let frame = 0;
    const measureSoon = (): void => {
      if (!measure() && ++frames < MAX_FRAMES) frame = requestAnimationFrame(measureSoon);
    };
    measureSoon();
    resize.observe(container);
    const observeContent = (): void => {
      for (const content of container.children) resize.observe(content);
    };
    observeContent();
    // Pierre's host is replaced when the diff is shown anew (another comparison method): observe the new one.
    const hosts = new MutationObserver(() => {
      observeContent();
      measure();
    });
    hosts.observe(container, { childList: true });
    // Scrolling renders the rows coming into view a frame later: measure then too.
    let scrollFrame = 0;
    const measureAgain = (): void => {
      measure();
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => void measure());
    };
    container.addEventListener('scroll', measureAgain, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      resize.disconnect();
      hosts.disconnect();
      container.removeEventListener('scroll', measureAgain);
    };
  }, [containerRef, linesKey, layout]);

  return boxes;
}

const NO_BOXES: ReadonlyMap<string, LineBox> = new Map();

/** The first row of a side's code (`topRowOf`), while the file's top is rendered: Pierre's buffer stands for what isn't. */
function topRowIn(root: ShadowRoot | null, { side }: ChangedLine, layout: CodeLayout): Element | null {
  const content = root?.querySelector(paneContentSelector(side, layout));
  if (!root || !content) return null;
  const virtualizedAbove = root.querySelector('[data-virtualizer-buffer="before"]') !== null;
  return topRowOf(content.children, (row) => row.hasAttribute('data-line-annotation'), virtualizedAbove);
}

function sameBoxes(a: ReadonlyMap<string, LineBox>, b: ReadonlyMap<string, LineBox>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, box] of a) {
    const other = b.get(key);
    if (!other || other.top !== box.top || other.bottom !== box.bottom || other.contentLeft !== box.contentLeft || other.paneRight !== box.paneRight) return false;
  }
  return true;
}
