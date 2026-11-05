import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useKeySettled } from '../../lib/useKeySettled';
import { referencesOfBlocks } from '../comments/remoteObjects';
import { issueKeysOf } from './issueKeysOf';
import { issueQuery } from './issueQueries';
import { usePlaceTracker } from './useIssueTrackers';

/**
 * A comment shown in full reads its issues as it shows, once what it shows stayed put for `SELECTION_SETTLE_MS`
 * (`useKeySettled`): the rows an arrow key passes through read nothing. One request for all of them, with whatever
 * else the window asked in the same task (`IssueReadBatch`); a focus reads them again once stale. Its chips then show
 * their titles and statuses, and a bare `#12` found becomes one.
 */
export function ResolvedIssues({ blocks }: { blocks: readonly unknown[] }): null {
  const tracker = usePlaceTracker();
  const keys = useMemo(() => issueKeysOf(referencesOfBlocks(blocks)), [blocks]);
  const settled = useKeySettled(keys.join(' '));
  useQueries({ queries: tracker ? keys.map((key) => ({ ...issueQuery(tracker.connection.id, key), enabled: settled })) : [] });
  return null;
}
