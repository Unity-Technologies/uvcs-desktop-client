import type { BranchesApi } from '@shared/api/branches';
import type { Branch, CreateBranchRequest } from '@shared/domain/branch';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import { findRecords, toBranch } from '../cm/findObjects';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

export function createBranchesService({ cm }: ServiceContext): BranchesApi {
  async function find(workspacePath: string, filter: QueryFilter, conditions: string[]): Promise<Branch[]> {
    const xml = await cm.query(findArgs('branch', { ...filter, branch: undefined }, 'date desc', conditions), { cwd: workspacePath });
    return findRecords(xml, 'BRANCH').map(toBranch);
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
    // `cm find` matches branches by their last name part only.
    const where = `where name = '${escapeQueryValue(shortBranchName(name))}'`;
    const xml = await cm.query(['find', 'branch', where, '--xml', '--nototal'], { cwd: workspacePath });
    return findRecords(xml, 'BRANCH').map(toBranch).find((branch) => branch.name === name) ?? null;
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

  return { list, get, create, rename, delete: remove, setHidden };
}

/** Without a starting point, `cm` starts the branch at the head of its parent. */
export function startingPointOption(startingPoint: string | undefined): string[] {
  if (startingPoint === undefined) return [];
  if (startingPoint.startsWith('cs:')) return [`--changeset=${startingPoint}`];
  if (startingPoint.startsWith('lb:')) return [`--label=${startingPoint}`];
  throw new Error(`A branch can only start at a changeset or a label, not ${startingPoint}.`);
}
