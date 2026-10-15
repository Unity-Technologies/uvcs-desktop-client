import type { QueriesObserver, QueryObserverResult } from '@tanstack/react-query';
import type { FrameClock } from '../../../lib/frameClock';

/**
 * How long results wait for a frame before they're handed over without one. Frames stop while the window is hidden,
 * minimised or covered: a merge loading meanwhile would otherwise hand all of its files over in the first frame back,
 * merging thousands at once just as the user returns.
 */
export const HIDDEN_HAND_OVER_MS = 250;

/**
 * Watches the queries of `observer`, which reads them as any view showing them would (and again when a refresh asks),
 * and hands their results to `onResults` at most once a frame, or after `HIDDEN_HAND_OVER_MS` when no frame comes. A
 * merge reads three versions of each of thousands of conflicting files (all but its known binaries), which answer one
 * after the other: rendering the page once per answer (`useQueries`, which also compares every query's options again on
 * each render) froze it for seconds. Returns how to stop watching.
 */
export function watchQueriesByFrame(observer: QueriesObserver, clock: FrameClock, onResults: (results: QueryObserverResult[]) => void): () => void {
  let pending: { frame: number; timer: ReturnType<typeof setTimeout> } | null = null;
  const cancelPending = (): void => {
    if (!pending) return;
    clock.cancel(pending.frame);
    clearTimeout(pending.timer);
    pending = null;
  };
  const handOver = (): void => {
    cancelPending();
    onResults(observer.getCurrentResult());
  };
  const unsubscribe = observer.subscribe(() => {
    pending ??= { frame: clock.request(handOver), timer: setTimeout(handOver, HIDDEN_HAND_OVER_MS) };
  });
  return () => {
    cancelPending();
    unsubscribe();
  };
}
