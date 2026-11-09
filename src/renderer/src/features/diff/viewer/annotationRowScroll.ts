import { getLineAnnotationName, type Virtualizer } from '@pierre/diffs';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import type { ChangedLine } from './changeBlocks';
import { ROW_FOCUS_ATTRIBUTE } from './diffAnnotations';
import { pierreLineBox } from './pierreLinePosition';
import { framedScrollTop, scrollTopFor, type RowFrame } from './rowPosition';
import { scrollSmoothlyTo } from './smoothScrollPlan';

/** Frames to wait for the diff to render the row: it may only just have loaded, or render only the lines in view. */
const MAX_FRAMES = 60;
/** Frames the row must keep its place before the scroll ends: rows above it, and the row itself, grow as they render. */
const SETTLED_FRAMES = 3;
/** A line's height before the diff has laid one out. */
const FALLBACK_LINE_HEIGHT = 20;

/**
 * Scrolls the diff in `container` so the row under `line` (a place's `DiffAnnotations.rows`), and its part gone to
 * (`ROW_FOCUS_ATTRIBUTE`), read with context, a third of the way down (`framedScrollTop`). A row the diff already shows is glided
 * to (`scrollSmoothlyTo`); one not rendered yet (a file just opened, a row far away in a big diff) is jumped to where
 * Pierre lays its line out, then set right as it renders. It keeps it framed until it stops moving. Returns a function
 * that stops it.
 */
export function scrollToAnnotationRow(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer): () => void {
  let frames = 0;
  let frame = 0;
  let settled = 0;
  let aimedAt: number | null = null;
  let glides: boolean | undefined;
  const attempt = (): void => {
    const rowFrame = rowFrameOf(container, line, virtualizer);
    if (rowFrame) {
      // Rendered the first time it's looked for: the diff was showing it already, and the reader sees it move there.
      glides ??= true;
      const to = framedScrollTop(rowFrame, { scrollTop: aimedAt ?? container.scrollTop, height: container.clientHeight, contentHeight: container.scrollHeight });
      if (to === null || (aimedAt !== null && Math.abs(to - aimedAt) < 1)) settled++;
      else {
        settled = 0;
        aimedAt = to;
        if (glides) scrollSmoothlyTo(container, to, prefersReducedMotion());
        else container.scrollTo({ top: to, behavior: 'auto' });
      }
      if (settled >= SETTLED_FRAMES) return;
    } else {
      glides = false;
      jumpNear(container, line, virtualizer);
    }
    if (++frames < MAX_FRAMES) frame = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(frame);
}

/** Where the row and its line are in the scrolled content, once the row is rendered. */
function rowFrameOf(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer): RowFrame | null {
  const row = container.querySelector(`[slot="${getLineAnnotationName(line)}"]`);
  const rowBox = row?.getBoundingClientRect();
  // A row whose line isn't rendered has no slot to show in, and no box.
  if (!row || !rowBox || rowBox.height === 0) return null;
  const focusBox = (row.querySelector(`[${ROW_FOCUS_ATTRIBUTE}]`) ?? row).getBoundingClientRect();
  const offset = container.scrollTop - container.getBoundingClientRect().top;
  const lineHeight = line.lineNumber < 1 ? 0 : (lineBox(container, line, virtualizer)?.height ?? FALLBACK_LINE_HEIGHT);
  return { lineTop: rowBox.top + offset - lineHeight, focusTop: focusBox.top + offset, focusBottom: focusBox.bottom + offset, lineHeight };
}

/** Scrolls to where Pierre lays the line out, so its row renders; the rows above the code are at the diff's top. */
function jumpNear(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer): void {
  if (line.lineNumber < 1) return void (container.scrollTop = 0);
  const box = lineBox(container, line, virtualizer);
  if (box) container.scrollTop = scrollTopFor(box.top, container.clientHeight / 3);
}

function lineBox(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer): { top: number; height: number } | undefined {
  const fileContainer = container.querySelector('diffs-container');
  return fileContainer ? pierreLineBox(virtualizer, fileContainer, line) : undefined;
}
