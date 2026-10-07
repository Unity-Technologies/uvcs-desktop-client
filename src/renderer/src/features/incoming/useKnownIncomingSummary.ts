import type { IncomingSummary } from '@shared/domain/incoming';
import { knownIncomingSummary } from './incomingChipState';
import { listedIncomingChangesets } from './olderChangesetPages';
import { useReadOlderIncomingPages } from './useIncomingChangesets';
import { useIncomingChanges } from './useIncomingChanges';
import { useIncomingSummary } from './useIncomingSummary';

/**
 * Where the workspace stands as best known (`knownIncomingSummary`): the incoming check, counting further once the
 * incoming changes are in for its head, and exactly once Incoming read all their older pages. Reads nothing itself: it
 * only looks at what the check and Incoming read.
 */
export function useKnownIncomingSummary(): IncomingSummary | undefined {
  const { data: summary } = useIncomingSummary();
  const { data: changes } = useIncomingChanges({ enabled: false });
  const read = changes?.branch ? changes : undefined;
  const pages = useReadOlderIncomingPages(read);
  return knownIncomingSummary(summary, changes, read && pages && listedIncomingChangesets(read, pages));
}
