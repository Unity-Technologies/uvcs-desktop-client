import { useEffect, useRef, useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { freshlyChangedPaths, isBurst, recordSightings, type ChangeSighting } from './changeBurst';

/**
 * Whether many files changed at once since the view opened on the workspace. The first read is where things stand,
 * not a burst: only what changes after it counts. Once seen, a burst stays until the workspace changes.
 */
export function useChangeBurst(workspacePath: string, changes: PendingChange[], settled: boolean): boolean {
  const lastRead = useRef<{ workspacePath: string; changes: PendingChange[] } | null>(null);
  const sightings = useRef<ChangeSighting[]>([]);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!settled) return;
    const previous = lastRead.current?.workspacePath === workspacePath ? lastRead.current.changes : null;
    lastRead.current = { workspacePath, changes };
    if (!previous) {
      sightings.current = [];
      setBurst(false);
      return;
    }
    sightings.current = recordSightings(sightings.current, freshlyChangedPaths(previous, changes), Date.now());
    if (isBurst(sightings.current)) setBurst(true);
  }, [workspacePath, changes, settled]);

  return burst;
}
