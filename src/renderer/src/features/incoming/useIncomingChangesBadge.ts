import type { NavBadge } from '../../ui/nav/navBadgeText';
import { useKnownIncomingSummary } from './useKnownIncomingSummary';

/** The sidebar's count of the changesets on the loaded branch the workspace does not have yet: "100+" past the check's limit. */
export function useIncomingChangesBadge(): NavBadge | undefined {
  const summary = useKnownIncomingSummary();
  return summary && { count: summary.changesetCount, more: summary.countCapped };
}
