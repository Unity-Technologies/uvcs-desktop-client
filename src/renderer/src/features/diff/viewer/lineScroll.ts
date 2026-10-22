import type { Virtualizer } from '@pierre/diffs';
import type { ChangedLine } from './changeBlocks';
import { pierreLinePosition } from './pierreLinePosition';

/** Frames to wait for the diff to lay the line out: it may only just have loaded. */
const MAX_FRAMES = 60;
/** Where the line goes in the view, from its top: a third of the way down, with what comes before it in view. */
const VIEW_FRACTION_ABOVE = 1 / 3;

/**
 * Scrolls the diff in `container` so `line` stands a third of the way down the view, as a link's `#L42` opens it,
 * whether its row is rendered or not (Pierre lays the diff out from line heights it knows or estimates:
 * `pierreLinePosition`). Its position is set right once more on the next frame, once rows above it rendered at their
 * real height. Returns a function that stops it.
 */
export function scrollToLine(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer): () => void {
  let frames = 0;
  let placed = 0;
  let frame = 0;
  const attempt = (): void => {
    const fileContainer = container.querySelector('diffs-container');
    const top = fileContainer ? pierreLinePosition(virtualizer, fileContainer, line) : undefined;
    if (top !== undefined) {
      container.scrollTop = Math.max(0, top - container.clientHeight * VIEW_FRACTION_ABOVE);
      placed++;
    }
    if (placed < 2 && ++frames < MAX_FRAMES) frame = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(frame);
}
