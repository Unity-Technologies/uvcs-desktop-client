import type { QueriesObserver, QueryObserverResult } from '@tanstack/react-query';
import type { FrameClock } from '../../../lib/frameClock';

/**
 * Watches the queries of `observer`, which reads them as any view showing them would (and again when a refresh asks),
 * and hands their results to `onResults` at most once a frame. A merge reads three versions of each of thousands of
 * conflicting files, which answer one after the other: rendering the page once per answer (`useQueries`, which also
 * compares every query's options again on each render) froze it for seconds. Returns how to stop watching.
 */
export function watchQueriesByFrame(observer: QueriesObserver, clock: FrameClock, onResults: (results: QueryObserverResult[]) => void): () => void {
  let frame: number | null = null;
  const handOver = (): void => {
    frame = null;
    onResults(observer.getCurrentResult());
  };
  const unsubscribe = observer.subscribe(() => {
    frame ??= clock.request(handOver);
  });
  return () => {
    if (frame !== null) clock.cancel(frame);
    unsubscribe();
  };
}
