import type { BranchesApi } from '@shared/api/branches';
import type { Branch, CreateBranchRequest } from '@shared/domain/branch';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import { findRecords, toBranch } from '../cm/findObjects';
import { withTempFile } from '../files/tempFile';
import { loadRecentBranches, saveRecentBranch } from '../plasticConfig/recentBranches';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createBranchesService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): BranchesApi {
  async function find(workspacePath: string, filter: QueryFilter, conditions: string[]): Promise<Branch[]> {
    const xml = await cm.query(findArgs('branch', { ...filter, branch: undefined }, 'date desc', conditions), { cwd: workspacePath });
    const branches = findRecords(xml, 'BRANCH').map(toBranch);
    // The code review chips name branches by id: this list answers them.
    branchNames.remember(workspacePath, branches);
    return branches;
  }

  async function list(workspacePath: string, filter: QueryFilter): Promise<Branch[]> {
    // `cm find branch` leaves hidden branches out unless they are asked for explicitly.
    const [visible, hidden] = await Promise.all([
      find(workspacePath, filter, ["hidden = 'false'"]),
      filter.includeHidden ? find(workspacePath, filter, ["hidden = 'true'"]) : Promise.resolve([]),
    ]);
    return [...visible, ...hidden.map((branch) => ({ ...branch, isHidden: true }))].sort((a, b) => b.date.localeCompare(a.date));
  }

  async function get(workspacePath: string, name: string): Promise<Branch | null> {
    // `cm find` matches branches by their last name part only, and leaves hidden branches out unless they are asked
    // for (a workspace can be on one): both are asked for, as `or` there finds neither.
    const named = `name = '${escapeQueryValue(shortBranchName(name))}'`;
    const findNamed = (condition: string): Promise<string> =>
      cm.query(['find', 'branch', `where ${named} and ${condition}`, '--xml', '--nototal'], { cwd: workspacePath });
    const [visible, hidden] = await Promise.all([findNamed("hidden = 'false'"), findNamed("hidden = 'true'")]);
    const branches = [
      ...findRecords(visible, 'BRANCH').map(toBranch),
      ...findRecords(hidden, 'BRANCH').map((record) => ({ ...toBranch(record), isHidden: true })),
    ];
    return branches.find((branch) => branch.name === name) ?? null;
  }

  function create(workspacePath: string, request: CreateBranchRequest): Promise<void> {
    return withTempFile(request.comment, async (commentsFile) => {
      await cm.query(['branch', 'create', request.name, ...startingPointOption(request.startingPoint), `-commentsfile=${commentsFile}`], {
        cwd: workspacePath,
      });
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
    return loadRecentBranches(await workspaceGuid(workspacePath));
  }

  async function rememberRecent(workspacePath: string, branchGuid: string): Promise<void> {
    await saveRecentBranch(await workspaceGuid(workspacePath), branchGuid);
  }

  return { list, get, create, rename, delete: remove, setHidden, recent, rememberRecent };
}

/** Without a starting point, `cm` starts the branch at the head of its parent. */
export function startingPointOption(startingPoint: string | undefined): string[] {
  if (startingPoint === undefined) return [];
  if (startingPoint.startsWith('cs:')) return [`--changeset=${startingPoint}`];
  if (startingPoint.startsWith('lb:')) return [`--label=${startingPoint}`];
  throw new Error(`A branch can only start at a changeset or a label, not ${startingPoint}.`);
}
