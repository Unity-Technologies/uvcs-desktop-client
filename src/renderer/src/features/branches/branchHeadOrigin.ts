import type { Branch } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import type { NewBranchOrigin } from './CreateBranchDialog';

/** A new child branch of `branch`, starting at its head: "New branch" on a branch, from its menu or the Branches view. */
export function branchHeadOrigin(branch: Pick<Branch, 'name' | 'headChangeset'>): NewBranchOrigin {
  return {
    parentBranch: branch.name,
    startingPoint: spec.changeset(branch.headChangeset),
    startingPointLabel: `the head of ${branch.name} (changeset ${branch.headChangeset})`,
  };
}
