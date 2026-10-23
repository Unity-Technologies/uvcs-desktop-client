import type { BranchesApi } from '@shared/api/branches';
import type { Branch, CreateBranchRequest } from '@shared/domain/branch';
import type { Place } from '@shared/domain/place';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import { branchCreateArgs } from '../cm/branchCreateArgs';
import { cmPlace } from '../cm/cmPlace';
import { equalsCondition, findArgs } from '../cm/findQuery';
import { FOUND_BRANCHES } from '../cm/foundObjects';
import { layoutReader } from '../cm/formatRecords';
import { withTempFile } from '../files/tempFile';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createBranchesService({ cm, settings, headers }: ServiceContext, { branchNames }: BranchNamesContext): BranchesApi {
  async function find(place: Place, filter: QueryFilter, conditions: string[]): Promise<Branch[]> {
    const at = cmPlace(place);
    const args = findArgs(FOUND_BRANCHES, { ...filter, branch: undefined }, 'date desc', conditions, at.repository);
    const branches = await cm.queryRecords(args, layoutReader(FOUND_BRANCHES), at.options);
    // The code review chips name branches by id: this list answers them.
    branchNames.remember(place, branches);
    return branches;
  }

  /**
   * `cm find branch` leaves hidden branches out unless they are asked for, and `or` between the two finds neither:
   * hidden branches take a second query, only when wanted.
   */
  async function findVisibleAndHidden(place: Place, filter: QueryFilter, conditions: string[], withHidden: boolean): Promise<Branch[]> {
    const [visible, hidden] = await Promise.all([
      find(place, filter, [...conditions, "hidden = 'false'"]),
      withHidden ? find(place, filter, [...conditions, "hidden = 'true'"]) : [],
    ]);
    return [...visible, ...hidden.map((branch) => ({ ...branch, isHidden: true }))];
  }

  async function list(place: Place, filter: QueryFilter): Promise<Branch[]> {
    const branches = await findVisibleAndHidden(place, filter, [], filter.includeHidden === true);
    return branches.sort((a, b) => b.date.localeCompare(a.date));
  }

  async function get(place: Place, name: string): Promise<Branch | null> {
    // `cm find` matches branches by their last name part only; a workspace can be on a hidden branch.
    const named = await findVisibleAndHidden(place, {}, [equalsCondition('name', shortBranchName(name))], true);
    return named.find((branch) => branch.name === name) ?? null;
  }

  function create(place: Place, request: CreateBranchRequest): Promise<void> {
    const at = cmPlace(place);
    return withTempFile(request.comment, async (commentsFile) => {
      await cm.query(branchCreateArgs(request, commentsFile, at), at.options);
    });
  }

  async function rename(place: Place, branch: string, newName: string): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['branch', 'rename', at.spec(`br:${branch}`), newName], at.options);
  }

  /** The comment goes in a file: a `cm shell` line can't carry quotes or line breaks. */
  function editComment(place: Place, branch: string, comment: string): Promise<void> {
    const at = cmPlace(place);
    return withTempFile(comment, async (commentsFile) => {
      await cm.query(['branch', 'editcomment', at.spec(`br:${branch}`), `-commentsfile=${commentsFile}`], at.options);
    });
  }

  async function remove(place: Place, branches: string[]): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['branch', 'delete', ...branches.map((branch) => at.spec(`br:${branch}`))], at.options);
  }

  async function setHidden(place: Place, branches: string[], hidden: boolean): Promise<void> {
    const at = cmPlace(place);
    await cm.query(['branch', hidden ? 'hide' : 'unhide', ...branches.map((branch) => at.spec(`br:${branch}`))], at.options);
  }

  /** From the workspace's names, which the workspace info shares: asked for just before, they cost no command. */
  async function workspaceGuid(workspacePath: string): Promise<string> {
    return (await headers.names(workspacePath)).guid;
  }

  async function recent(workspacePath: string): Promise<string[]> {
    return settings.get().recentBranchesByWorkspace[await workspaceGuid(workspacePath)] ?? [];
  }

  async function rememberRecent(workspacePath: string, branchGuid: string): Promise<void> {
    settings.rememberRecentBranch(await workspaceGuid(workspacePath), branchGuid);
  }

  return { list, get, create, rename, editComment, delete: remove, setHidden, recent, rememberRecent };
}
