import type { IncomingSummary } from '@shared/domain/incoming';
import { knownIncomingSummary } from './incomingChipState';
import { useIncomingChanges } from './useIncomingChanges';
import { useIncomingSummary } from './useIncomingSummary';

/**
 * Where the workspace stands as best known (`knownIncomingSummary`): the incoming check, counting further once the
 * incoming changes are in for its head. Reads nothing itself: it only looks at what the check and Incoming read.
 */
export function useKnownIncomingSummary(): IncomingSummary | undefined {
  const { data: summary } = useIncomingSummary();
  const { data: changes } = useIncomingChanges({ enabled: false });
  return knownIncomingSummary(summary, changes);
}
