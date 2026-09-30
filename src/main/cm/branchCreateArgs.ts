import type { CreateBranchRequest } from '@shared/domain/branch';

/** `cm branch create` of the branch asked for, at its starting point, with the comment read from a file. */
export function branchCreateArgs({ name, startingPoint }: Omit<CreateBranchRequest, 'comment'>, commentsFile: string): string[] {
  return ['branch', 'create', name, ...startingPointOption(startingPoint), `-commentsfile=${commentsFile}`];
}

/** Without a starting point, `cm` starts the branch at the head of its parent. */
function startingPointOption(startingPoint: string | undefined): string[] {
  if (startingPoint === undefined) return [];
  if (startingPoint.startsWith('cs:')) return [`--changeset=${startingPoint}`];
  if (startingPoint.startsWith('lb:')) return [`--label=${startingPoint}`];
  throw new Error(`A branch can only start at a changeset or a label, not ${startingPoint}.`);
}
