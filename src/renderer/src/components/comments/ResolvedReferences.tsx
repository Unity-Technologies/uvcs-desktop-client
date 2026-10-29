import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import { useKeySettled } from '../../lib/useKeySettled';
import { referencesOfBlocks, referencesToResolve, remoteObjectQuery } from './remoteObjects';

/**
 * A comment shown in full reads its other repositories' objects as it shows (`referencesToResolve`: up to
 * `MAX_RESOLVED_PER_COMMENT`, once each, on the place's server), once what it shows stayed put for
 * `SELECTION_SETTLE_MS` (`useKeySettled`), the first row after a pause too: the rows an arrow key passes through, or a
 * glance, read nothing. Its chips then show their summaries; the rest read as their cards open. A component, not a
 * hook, so only a comment, shown in a place's window, reads the place (release notes show outside one).
 */
export function ResolvedReferences({ blocks }: { blocks: readonly unknown[] }): null {
  const placeRepository = usePlaceRepository();
  const queryClient = useQueryClient();
  const objects = useMemo(() => referencesToResolve(referencesOfBlocks(blocks), placeRepository), [blocks, placeRepository]);
  const key = objects.map((object) => JSON.stringify(object)).join();
  const settled = useKeySettled(key);
  useEffect(() => {
    if (!settled) return;
    for (const object of objects) void queryClient.prefetchQuery(remoteObjectQuery(object));
  }, [settled, key]);
  return null;
}
