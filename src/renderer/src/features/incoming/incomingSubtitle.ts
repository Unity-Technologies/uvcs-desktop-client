import { branchLabel } from '../../lib/branchLabels';
import { formatCountAtLeast } from '../../lib/text';

/**
 * What Incoming's header says once changesets came in: as many as its list read ("200+ new on main" while older pages
 * remain), so it agrees with the list and turns exact once the last page is in.
 */
export function incomingSubtitle(branch: string, list: { changesets: readonly unknown[]; more: boolean }): string {
  return `${formatCountAtLeast(list.changesets.length, list.more)} new on ${branchLabel(branch)}`;
}
