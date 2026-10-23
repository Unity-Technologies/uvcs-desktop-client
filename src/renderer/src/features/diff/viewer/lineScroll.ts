import type { Virtualizer } from '@pierre/diffs';
import type { ChangedLine } from './changeBlocks';
import { scrollTopFor } from './keptPlace';
import { pierreLinePosition } from './pierreLinePosition';

/** Frames to wait for the diff to lay the line out: it may only just have loaded. */
const MAX_FRAMES = 60;
/** Where a link's line goes in the view: a third of the way down, with what comes before it in view. */
export const A_THIRD_DOWN = (container: HTMLElement): number => container.clientHeight / 3;

/**
 * Scrolls the diff in `container` so `line` stands `fromTop` pixels below the top of the view (a third of the way
 * down, as a link's `#L42` opens it, by default), whether its row is rendered or not (Pierre lays the diff out from
 * line heights it knows or estimates: `pierreLinePosition`; a line collapsed away, at the bar standing for it). Its
 * position is set right once more on the next frame, once rows above it rendered at their real height. Returns a
 * function that stops it.
 */
export function scrollToLine(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer, fromTop: (container: HTMLElement) => number = A_THIRD_DOWN): () => void {
  let frames = 0;
  let placed = 0;
  let frame = 0;
  const attempt = (): void => {
    const fileContainer = container.querySelector('diffs-container');
    const top = fileContainer ? pierreLinePosition(virtualizer, fileContainer, line) : undefined;
    if (top !== undefined) {
      container.scrollTop = scrollTopFor(top, fromTop(container));
      placed++;
    }
    if (placed < 2 && ++frames < MAX_FRAMES) frame = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(frame);
}
