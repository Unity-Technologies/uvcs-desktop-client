import type { BranchExplorerQuery } from '@shared/domain/branchExplorer';
import { sinceDateFor, type SincePreset } from '../../../lib/sincePresets';

/**
 * What the Branch Explorer asks the server for: the history since the range's first day (all of it for "Any time"),
 * hidden branches only when shown. Coming back to the window re-reads a date range, never all history: on a big
 * repository that is every changeset and merge (Refresh does it).
 */
export function historyRead(dateRange: SincePreset, showHiddenBranches: boolean, now = new Date()): { query: BranchExplorerQuery; rereadOnFocus: boolean } {
  const query = { sinceDate: sinceDateFor(dateRange, now), includeHidden: showHiddenBranches };
  return { query, rereadOnFocus: query.sinceDate !== undefined };
}
