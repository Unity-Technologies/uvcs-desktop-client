import { navigation } from '../../app/navigation/navigationStore';
import { pickedBranchFilters } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';

/**
 * The Changesets view on one branch's changesets, from the branch's menu ("Show changesets"): the branch picked as the
 * branch chip picks it (`pickedBranchFilters`), its whole history, leaving what the view remembers as it was.
 */
export function showBranchChangesets(workspacePath: string, branch: string): void {
  useChangesetFilters.getState().update(pickedBranchFilters(workspacePath, branch));
  navigation.goToView('changesets');
}
