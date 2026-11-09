import { useEffect, useState, type RefObject } from 'react';
import type { ChangedLine } from './changeBlocks';
import { lineNumberCellSelector, type CodeLayout } from './lineActions';
import { paneRect, pierreShadowRoot } from './pierreDom';

/** Where a line is, in the container's scrolled content: its row's top and bottom, and its pane's right edge. */
export interface LineBox {
  top: number;
  bottom: number;
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
    /** Measures every line rendered; false while none of them is. */
    const measure = (): boolean => {
      const root = pierreShadowRoot(container);
      const view = container.getBoundingClientRect();
      const next = new Map<string, LineBox>();
      for (const line of lines) {
        const cell = root?.querySelector(lineNumberCellSelector(line, layout));
        const pane = cell?.closest('[data-code]');
        if (!cell || !pane) continue;
        const rect = cell.getBoundingClientRect();
        next.set(line.key, {
          top: rect.top - view.top + container.scrollTop,
          bottom: rect.bottom - view.top + container.scrollTop,
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
    // The container's size, and its content's: rows growing above a line (a thread opened, a region unfolded) move it.
    const resize = new ResizeObserver(() => void measure());
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

function sameBoxes(a: ReadonlyMap<string, LineBox>, b: ReadonlyMap<string, LineBox>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, box] of a) {
    const other = b.get(key);
    if (!other || other.top !== box.top || other.bottom !== box.bottom || other.paneRight !== box.paneRight) return false;
  }
  return true;
}
