import type { Virtualizer } from '@pierre/diffs';
import type { ChangedLine } from './changeBlocks';
import { pierreLineBox } from './pierreLinePosition';
import { scrollTopFor } from './rowPosition';
import { PLACEMENT_START, placementStep } from './settledPlacement';
import { stopOnUserScroll } from './userScrollStop';

/** Frames to wait for the diff to lay the line out: it may only just have loaded. */
const MAX_FRAMES = 60;
/** Where a link's line goes in the view: a third of the way down, with what comes before it in view. */
export const A_THIRD_DOWN = (container: HTMLElement): number => container.clientHeight / 3;

/** How far below the top of the view a line goes, from the view and the line's height as laid out. */
export type LinePlace = (container: HTMLElement, lineHeight: number) => number;

/**
 * Scrolls the diff in `container` so `line` stands `fromTop` pixels below the top of the view (a third of the way
 * down, as a link's `#L42` opens it, by default), whether its row is rendered or not (Pierre lays the diff out from
 * line heights it knows or estimates: `pierreLinePosition`; a line collapsed away, at the bar standing for it). Its
 * position is set right on the frames that follow, as the rows around it render at their real heights, until it
 * stands still (`placementStep`), or the user moves the view (`stopOnUserScroll`). Returns a function that stops it.
 */
export function scrollToLine(container: HTMLElement, line: ChangedLine, virtualizer: Virtualizer, fromTop: LinePlace = A_THIRD_DOWN): () => void {
  let frames = 0;
  let placement = PLACEMENT_START;
  let frame = 0;
  const attempt = (): void => {
    const fileContainer = container.querySelector('diffs-container');
    const box = fileContainer ? pierreLineBox(virtualizer, fileContainer, line) : undefined;
    if (box) {
      const target = scrollTopFor(box.top, fromTop(container, box.height));
      const step = placementStep(placement, { target, scrollTop: container.scrollTop, maxScroll: container.scrollHeight - container.clientHeight });
      placement = step.state;
      if (step.scrollTo !== null) container.scrollTop = step.scrollTo;
      if (step.done) return stopListening();
    }
    if (++frames < MAX_FRAMES) frame = requestAnimationFrame(attempt);
    else stopListening();
  };
  const stop = (): void => {
    cancelAnimationFrame(frame);
    stopListening();
  };
  const stopListening = stopOnUserScroll(container, stop);
  attempt();
  return stop;
}
