import { useCallback, useEffect, useRef, useState } from 'react';
import { SELECTION_SETTLE_MS } from '../../lib/useSettled';
import { sameIds } from './sameIds';

const NONE: readonly number[] = [];

/**
 * The branches whose headers are in view or near it (`branchesNearView`), as the canvas reports them after each frame,
 * once the view stays put (`SELECTION_SETTLE_MS`): a pan or a fling renders nothing and asks for nothing on its way,
 * and only the branches it stops near have their reviews read (`useBranchReviews`). The report itself only keeps the
 * newest list, so it costs nothing per frame.
 */
export function useBranchesNearView(): [readonly number[], (branchIds: readonly number[]) => void] {
  const [settled, setSettled] = useState<readonly number[]>(NONE);
  const latest = useRef<readonly number[]>(NONE);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const report = useCallback((branchIds: readonly number[]) => {
    if (sameIds(branchIds, latest.current)) return;
    latest.current = branchIds;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSettled(latest.current), SELECTION_SETTLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return [settled, report];
}
