import type { IncomingSummary } from '@shared/domain/incoming';
import type { NavBadge } from '../../ui/nav/navBadgeText';

/**
 * How much is coming in, as a count: the changesets the loaded branch has that the workspace lacks ("100+" once the
 * check stopped counting), or in a partial workspace, which loads no one changeset, the items the branch head brings.
 */
export function incomingCount(summary: IncomingSummary | undefined): NavBadge | undefined {
  if (!summary) return undefined;
  if ('partial' in summary) return { count: summary.itemCount, more: false };
  return { count: summary.changesetCount, more: summary.countCapped };
}
