import type { BranchesApi } from '@shared/api/branches';
import type { Branch, CreateBranchRequest } from '@shared/domain/branch';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import { branchCreateArgs } from '../cm/branchCreateArgs';
import { equalsCondition, findArgs } from '../cm/findQuery';
import { FOUND_BRANCHES } from '../cm/foundObjects';
import { layoutReader } from '../cm/formatRecords';
import { withTempFile } from '../files/tempFile';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createBranchesService({ cm, settings, headers }: ServiceContext, { branchNames }: BranchNamesContext): BranchesApi {
  async function find(workspacePath: string, filter: QueryFilter, conditions: string[], repository?: string): Promise<Branch[]> {
    const args = findArgs(FOUND_BRANCHES, { ...filter, branch: undefined }, 'date desc', conditions, repository);
    const branches = await cm.queryRecords(args, layoutReader(FOUND_BRANCHES), { cwd: workspacePath });
    // The code review chips name the workspace's branches by id: this list answers them. Another repository's ids
    // are other branches.
    if (!repository) branchNames.remember(workspacePath, branches);
    return branches;
  }

  /**
   * `cm find branch` leaves hidden branches out unless they are asked for, and `or` between the two finds neither:
   * hidden branches take a second query, only when wanted.
   */
  async function findVisibleAndHidden(workspacePath: string, filter: QueryFilter, conditions: string[], withHidden: boolean, repository?: string): Promise<Branch[]> {
    const [visible, hidden] = await Promise.all([
      find(workspacePath, filter, [...conditions, "hidden = 'false'"], repository),
      withHidden ? find(workspacePath, filter, [...conditions, "hidden = 'true'"], repository) : [],
    ]);
    return [...visible, ...hidden.map((branch) => ({ ...branch, isHidden: true }))];
  }

  async function list(workspacePath: string, filter: QueryFilter, repository?: string): Promise<Branch[]> {
    const branches = await findVisibleAndHidden(workspacePath, filter, [], filter.includeHidden === true, repository);
    return branches.sort((a, b) => b.date.localeCompare(a.date));
  }

  async function get(workspacePath: string, name: string): Promise<Branch | null> {
    // `cm find` matches branches by their last name part only; a workspace can be on a hidden branch.
    const named = await findVisibleAndHidden(workspacePath, {}, [equalsCondition('name', shortBranchName(name))], true);
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

  /** The comment goes in a file: a `cm shell` line can't carry quotes or line breaks. */
  function editComment(workspacePath: string, branch: string, comment: string): Promise<void> {
    return withTempFile(comment, async (commentsFile) => {
      await cm.query(['branch', 'editcomment', `br:${branch}`, `-commentsfile=${commentsFile}`], { cwd: workspacePath });
    });
  }

  async function remove(workspacePath: string, branches: string[]): Promise<void> {
    await cm.query(['branch', 'delete', ...branches.map((branch) => `br:${branch}`)], { cwd: workspacePath });
  }

  async function setHidden(workspacePath: string, branches: string[], hidden: boolean): Promise<void> {
    await cm.query(['branch', hidden ? 'hide' : 'unhide', ...branches.map((branch) => `br:${branch}`)], { cwd: workspacePath });
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
