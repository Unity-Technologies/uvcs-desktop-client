import { MAIN_BRANCH_GUID, type Branch } from '@shared/domain/branch';

/**
 * The branch whose latest tree the Files view of a repository explored without a workspace shows: the one the user
 * chose while it is still listed, else the main branch (found by its GUID: it may have been renamed), else the first
 * branch listed. None until the branches are read, or for a repository with none.
 */
export function shownFilesBranch(branches: readonly Branch[] | undefined, chosen: string | undefined): Branch | null {
  if (!branches || branches.length === 0) return null;
  return (
    branches.find((branch) => branch.name === chosen) ??
    branches.find((branch) => branch.guid.toLowerCase() === MAIN_BRANCH_GUID) ??
    branches[0]!
  );
}

/** What the Files view's header says it shows: "Latest of /main · changeset 12". */
export function filesBranchCaption(branch: Pick<Branch, 'name' | 'headChangeset'>): string {
  return `Latest of ${branch.name} · changeset ${branch.headChangeset}`;
}
