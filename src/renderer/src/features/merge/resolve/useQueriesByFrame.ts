import { QueriesObserver, useQueryClient, type QueryObserverOptions, type QueryObserverResult } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { browserFrameClock } from '../../../lib/frameClock';
import { watchQueriesByFrame } from './watchQueriesByFrame';

/**
 * `useQueries` for thousands of queries: their results, in the same order, rendered again at most once a frame
 * (`watchQueriesByFrame`) and their options compared only when `queries` is a new array, so keep it stable.
 */
export function useQueriesByFrame<TData>(queries: readonly QueryObserverOptions<TData>[]): readonly QueryObserverResult<TData>[] {
  const client = useQueryClient();
  // Built in render, as `useQueries` builds its own: an observer subscribes (and reads) only in the effect, so one React
  // discards (StrictMode's second render, a memo dropped) costs nothing, and the effect subscribes the one kept.
  const observer = useMemo(() => new QueriesObserver(client, [...queries]), [client, queries]);
  const [handed, setHanded] = useState(() => ({ observer, results: observer.getCurrentResult() }));
  useEffect(() => watchQueriesByFrame(observer, browserFrameClock, (results) => setHanded({ observer, results })), [observer]);
  // New queries show what the cache holds for them at once, not the old queries' results until the next frame.
  const results = handed.observer === observer ? handed.results : observer.getCurrentResult();
  // `QueriesObserver` doesn't carry the queries' data type; every query here reads a `TData`.
  return results as QueryObserverResult<TData>[];
}
