import type { BranchesApi } from '@shared/api/branches';
import type { Branch, CreateBranchRequest } from '@shared/domain/branch';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import { branchCreateArgs } from '../cm/branchCreateArgs';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import { findRecords, toBranch } from '../cm/findObjects';
import { withTempFile } from '../files/tempFile';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createBranchesService({ cm, settings }: ServiceContext, { branchNames }: BranchNamesContext): BranchesApi {
  async function find(workspacePath: string, filter: QueryFilter, conditions: string[]): Promise<Branch[]> {
    const xml = await cm.query(findArgs('branch', { ...filter, branch: undefined }, 'date desc', conditions), { cwd: workspacePath });
    const branches = findRecords(xml, 'BRANCH').map(toBranch);
    // The code review chips name branches by id: this list answers them.
    branchNames.remember(workspacePath, branches);
    return branches;
  }

  /**
   * `cm find branch` leaves hidden branches out unless they are asked for, and `or` between the two finds neither:
   * hidden branches take a second query, only when wanted.
   */
  async function findVisibleAndHidden(workspacePath: string, filter: QueryFilter, conditions: string[], withHidden: boolean): Promise<Branch[]> {
    const [visible, hidden] = await Promise.all([
      find(workspacePath, filter, [...conditions, "hidden = 'false'"]),
      withHidden ? find(workspacePath, filter, [...conditions, "hidden = 'true'"]) : [],
    ]);
    return [...visible, ...hidden.map((branch) => ({ ...branch, isHidden: true }))];
  }

  async function list(workspacePath: string, filter: QueryFilter): Promise<Branch[]> {
    const branches = await findVisibleAndHidden(workspacePath, filter, [], filter.includeHidden === true);
    return branches.sort((a, b) => b.date.localeCompare(a.date));
  }

  async function get(workspacePath: string, name: string): Promise<Branch | null> {
    // `cm find` matches branches by their last name part only; a workspace can be on a hidden branch.
    const named = await findVisibleAndHidden(workspacePath, {}, [`name = '${escapeQueryValue(shortBranchName(name))}'`], true);
    return named.find((branch) => branch.name === name) ?? null;
  }

  function create(workspacePath: string, request: CreateBranchRequest): Promise<void> {
    return withTempFile(request.comment, async (commentsFile) => {
      await cm.query(branchCreateArgs(request, commentsFile), { cwd: workspacePath });
    });
  }

  async function rename(workspacePath: string, branch: string, newName: string): Promise<void> {
    await cm.query(['branch', 'rename', `br:${branch}`, newName], { cwd: workspacePath });
  }

  async function remove(workspacePath: string, branches: string[]): Promise<void> {
    await cm.query(['branch', 'delete', ...branches.map((branch) => `br:${branch}`)], { cwd: workspacePath });
  }

  async function setHidden(workspacePath: string, branches: string[], hidden: boolean): Promise<void> {
    await cm.query(['branch', hidden ? 'hide' : 'unhide', ...branches.map((branch) => `br:${branch}`)], { cwd: workspacePath });
  }

  async function workspaceGuid(workspacePath: string): Promise<string> {
    return (await cm.query(['getworkspacefrompath', workspacePath, '--format={guid}'])).trim();
  }

  async function recent(workspacePath: string): Promise<string[]> {
    return settings.get().recentBranchesByWorkspace[await workspaceGuid(workspacePath)] ?? [];
  }

  async function rememberRecent(workspacePath: string, branchGuid: string): Promise<void> {
    settings.rememberRecentBranch(await workspaceGuid(workspacePath), branchGuid);
  }

  return { list, get, create, rename, delete: remove, setHidden, recent, rememberRecent };
}
