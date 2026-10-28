import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import { useSettled, useSettledValue } from '../../lib/useSettled';
import { referencesOfBlocks, referencesToResolve, remoteObjectQuery } from './remoteObjects';

/**
 * A comment shown in full reads its other repositories' objects as it shows (`referencesToResolve`: up to
 * `MAX_RESOLVED_PER_COMMENT`, once each), once the selection showing it settles: the rows an arrow key passes
 * through read nothing. Its chips then show their summaries; the rest read as their cards open. A component, not a
 * hook, so only a comment, shown in a place's window, reads the place (release notes show outside one).
 */
export function ResolvedReferences({ blocks }: { blocks: readonly unknown[] }): null {
  const placeRepository = usePlaceRepository();
  const queryClient = useQueryClient();
  const objects = useMemo(() => referencesToResolve(referencesOfBlocks(blocks), placeRepository), [blocks, placeRepository]);
  const key = objects.map((object) => JSON.stringify(object)).join();
  const mounted = useSettled();
  const settledKey = useSettledValue(key, key);
  const settled = mounted && settledKey === key;
  useEffect(() => {
    if (!settled) return;
    for (const object of objects) void queryClient.prefetchQuery(remoteObjectQuery(object));
  }, [settled, key]);
  return null;
}
