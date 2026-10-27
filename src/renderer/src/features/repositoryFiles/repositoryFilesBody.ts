import type { Branch } from '@shared/domain/branch';
import type { WorkspaceInfo } from '@shared/domain/workspace';

/** The main branch's name, which Files shows until another branch is picked. */
export const MAIN_BRANCH_NAME = '/main';

/** A branch picked in Files, by its name to read it and its GUID to know it is still the same branch. */
export interface ChosenBranch {
  name: string;
  guid: string;
}

/** The branch Files reads alone (`branches.get`, a light `cm find`): the one picked, else the main branch. */
export function filesBranchToRead(chosen: ChosenBranch | undefined): string {
  return chosen?.name ?? MAIN_BRANCH_NAME;
}

/** What the Files view of a repository explored without a workspace shows (`repositoryFilesBodyOf`). */
export type RepositoryFilesBody =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'chosenGone' }
  | { kind: 'pickBranch' }
  | { kind: 'tree'; branch: Branch };

/**
 * What Files shows from the branch it read (`filesBranchToRead`): its latest tree; the branch picked gone, renamed or
 * another one by that name since (its GUID no longer the one picked), the main branch again; no main branch by that
 * name (renamed), a branch to pick.
 */
export function repositoryFilesBodyOf(read: { data: Branch | null | undefined; error: Error | null }, chosen: ChosenBranch | undefined): RepositoryFilesBody {
  if (read.error) return { kind: 'error', message: read.error.message };
  if (read.data === undefined) return { kind: 'loading' };
  if (chosen && read.data?.guid.toLowerCase() !== chosen.guid.toLowerCase()) return { kind: 'chosenGone' };
  return read.data === null ? { kind: 'pickBranch' } : { kind: 'tree', branch: read.data };
}

/** What the Files view's header says it shows: "Latest of /main · changeset 12". */
export function filesBranchCaption(branch: Pick<Branch, 'name' | 'headChangeset'>): string {
  return `Latest of ${branch.name} · changeset ${branch.headChangeset}`;
}

/**
 * Where the files come from, as a link names them (`filesItemLink`): a branch's latest, as a workspace on that branch
 * at its head would be. An item links to the branch, so it follows it; lines are pinned to the head changeset.
 */
export function branchFilesOrigin(repository: string, branch: Pick<Branch, 'name' | 'headChangeset'>): Pick<WorkspaceInfo, 'repository' | 'selector' | 'loadedChangeset'> {
  return { repository, selector: { kind: 'branch', name: branch.name }, loadedChangeset: branch.headChangeset };
}
