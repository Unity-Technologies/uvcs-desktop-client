import { useEffect, useRef, useState } from 'react';
import type { GraphLayout } from './model/layoutGraph';

/**
 * A branch created from the graph shows up once the refreshed history has it: then it is revealed, just once. Returns
 * what to call with its name when it is created.
 */
export function useCreatedBranchReveal(layout: GraphLayout | null, reveal: (name: string) => void): (name: string) => void {
  const [created, setCreated] = useState<string | null>(null);
  const latestReveal = useRef(reveal);
  latestReveal.current = reveal;
  useEffect(() => {
    if (created === null || !layout?.lanesByBranch.has(created)) return;
    setCreated(null);
    latestReveal.current(created);
  }, [created, layout]);
  return setCreated;
}
