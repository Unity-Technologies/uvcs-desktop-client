import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import type { PrintedMergePlan } from '../cm/mergeOutput';
import { readTreeItem, TREE_ITEM_FORMAT, type ListedTreeItem } from '../cm/treeItems';
import { readWorkspaceLoad } from '../cm/workspaceStatus';
import { revisionFilesOf, type WorkspaceCopies } from '../files/WorkspaceCopies';

/**
 * The plan with the repository of each conflicting file, and its revision in the destination. `cm merge` prints a file
 * under a writable xlink with the xlinked repository's item id and changesets, never the repository, and
 * `itemid:27#cs:12` reads the merged one's item 27, another file. One `cm ls` of the conflicting files in the
 * destination's tree reads each one's (it crosses xlinks), and only when some file conflicts. The destination's
 * revisions it lists are remembered with their hashes (`copies`): the workspace's disk serves each one its file has. Its
 * type tells a binary (`destinationIsBinary`) with no byte read.
 */
export async function withConflictRepositories(
  cm: CmClient,
  workspacePath: string,
  request: MergeRequest,
  plan: PrintedMergePlan,
  copies?: Pick<WorkspaceCopies, 'remember'>,
): Promise<MergePlan> {
  if (plan.fileConflicts.length === 0) return withRepositories(plan, []);
  const tree = destinationTree(request, plan) ?? (await loadedTree(cm, workspacePath));
  const listed = await cm.queryRecords(conflictListingArgs(plan, tree), readTreeItem, { cwd: workspacePath });
  copies?.remember(workspacePath, revisionFilesOf(listed));
  return withRepositories(plan, listed);
}

/**
 * The tree the merge goes into: its destination contributor, else the branch merged into. Null for a workspace merge
 * whose contributors `cm` didn't print: the workspace's loaded changeset is its destination then.
 */
export function destinationTree(request: MergeRequest, plan: PrintedMergePlan): string | null {
  const destination = plan.contributors?.destination.changesetId;
  if (destination !== undefined) return spec.changeset(destination);
  return request.destinationBranch ? spec.branch(request.destinationBranch) : null;
}

/** The workspace's loaded changeset. A workspace on a shelve takes no merges: `cm` finds no branch to check out on. */
async function loadedTree(cm: CmClient, workspacePath: string): Promise<string> {
  const { loadedChangeset } = await readWorkspaceLoad(cm, workspacePath);
  if (loadedChangeset === null) throw new Error("A workspace on a shelve can't take a merge. Switch it to a branch first.");
  return spec.changeset(loadedChangeset);
}

/** `cm ls` of the conflicting files in `tree`. */
export function conflictListingArgs(plan: PrintedMergePlan, tree: string): string[] {
  return ['ls', ...plan.fileConflicts.map((conflict) => conflict.path), `--tree=${tree}`, TREE_ITEM_FORMAT];
}

/** Completes the plan's conflicts with the repositories, revisions and types `cm ls` listed for their paths. */
export function withRepositories(plan: PrintedMergePlan, listed: readonly ListedTreeItem[]): MergePlan {
  const byPath = new Map(listed.map((item) => [item.path, item]));
  return {
    ...plan,
    fileConflicts: plan.fileConflicts.map((conflict) => {
      const item = byPath.get(conflict.path.replace(/^\//, ''));
      if (!item?.repository) throw new Error(`Couldn't tell which repository ${conflict.path} is in.`);
      if (item.revisionId <= 0) throw new Error(`Couldn't tell which version of ${conflict.path} the destination has.`);
      return { ...conflict, repository: item.repository, destinationRevisionId: item.revisionId, destinationIsBinary: item.itemType === 'binaryFile' };
    }),
  };
}
