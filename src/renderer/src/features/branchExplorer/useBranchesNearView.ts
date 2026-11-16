import { useCallback, useRef, useState } from 'react';

const NONE: readonly number[] = [];

/**
 * The branches whose headers are in view or near it (`branchesNearView`), as the canvas reports them after each frame:
 * a new list only when they change, so panning within the same branches renders nothing, and the reviews of a branch
 * that comes near are asked for once (`useBranchReviews`).
 */
export function useBranchesNearView(): [readonly number[], (branchIds: readonly number[]) => void] {
  const [near, setNear] = useState<readonly number[]>(NONE);
  const nearRef = useRef(near);
  const report = useCallback((branchIds: readonly number[]) => {
    const current = nearRef.current;
    if (branchIds.length === current.length && branchIds.every((id, index) => id === current[index])) return;
    nearRef.current = branchIds;
    setNear(branchIds);
  }, []);
  return [near, report];
}
