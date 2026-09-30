import { useEffect, useRef, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { watchRead, type BurstWatch } from './changeBurst';

/**
 * Whether many files changed at once since the view opened on the workspace. The first read is where things stand,
 * not a burst: only what changes after it counts. Once seen, a burst stays until the workspace changes.
 */
export function useChangeBurst(workspacePath: string, changes: PendingChange[], settled: boolean): boolean {
  const watch = useRef<BurstWatch | null>(null);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!settled) return;
    watch.current = watchRead(watch.current, workspacePath, changes, Date.now());
    setBurst(watch.current.burst);
  }, [workspacePath, changes, settled]);

  return burst;
}
