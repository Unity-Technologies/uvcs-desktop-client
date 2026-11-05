import { useQueries } from '@tanstack/react-query';
import { useKeySettled } from '../../lib/useKeySettled';
import { issueQuery } from './issueQueries';
import { usePlaceTracker } from './useIssueTrackers';

/**
 * Reads `keys` of the place's tracker once they stayed put for `SELECTION_SETTLE_MS` (`useKeySettled`): one request for
 * all of them, with whatever else the window asked in the same task (`IssueReadBatch`); a focus reads them again once
 * stale. The chips naming them then show their titles and statuses.
 */
export function useIssueReads(keys: readonly string[]): void {
  const tracker = usePlaceTracker();
  const settled = useKeySettled(keys.join(' '));
  useQueries({ queries: tracker ? keys.map((key) => ({ ...issueQuery(tracker.connection.id, key), enabled: settled })) : [] });
}
