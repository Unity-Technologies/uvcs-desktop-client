import type { NavBadge } from '../../ui/nav/navBadgeText';
import { incomingCount } from './incomingCount';
import { useKnownIncomingSummary } from './useKnownIncomingSummary';

/** The sidebar's count of what is coming in: changesets on the loaded branch, or items in a partial workspace. */
export function useIncomingChangesBadge(): NavBadge | undefined {
  return incomingCount(useKnownIncomingSummary());
}
