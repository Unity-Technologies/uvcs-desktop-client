import { navigation } from '../../app/navigation/navigationStore';
import { pickedBranchFilters } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';

/**
 * The Changesets view on one branch's changesets, from the branch's menu ("Show changesets"): the branch picked by
 * name, Any time (capped as always) so an old branch shows its changesets too, and no text or people hiding some.
 */
export function showBranchChangesets(workspacePath: string, branch: string): void {
  const filters = useChangesetFilters.getState();
  filters.clear();
  filters.update({ ...pickedBranchFilters(workspacePath, branch), since: 'anyTime' });
  navigation.goToView('changesets');
}
