import type { CreateBranchRequest } from '@shared/domain/branch';
import type { CmPlace } from './cmPlace';

/**
 * `cm branch create` of the branch asked for, at its starting point, with the comment read from a file. In a workspace
 * the name goes as written; with none, as the spec naming the repository (`br:/main/task@game@local`), as its
 * starting point does.
 */
export function branchCreateArgs({ name, startingPoint }: Omit<CreateBranchRequest, 'comment'>, commentsFile: string, at: CmPlace): string[] {
  return ['branch', 'create', at.newObject('br', name), ...startingPointOption(startingPoint && at.spec(startingPoint)), `-commentsfile=${commentsFile}`];
}

/** Without a starting point, `cm` starts the branch at the head of its parent. */
function startingPointOption(startingPoint: string | undefined): string[] {
  if (startingPoint === undefined) return [];
  if (startingPoint.startsWith('cs:')) return [`--changeset=${startingPoint}`];
  if (startingPoint.startsWith('lb:')) return [`--label=${startingPoint}`];
  throw new Error(`A branch can only start at a changeset or a label, not ${startingPoint}.`);
}
