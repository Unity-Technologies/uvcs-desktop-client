import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import type { PrintedMergePlan } from '../cm/mergeOutput';
import { parseTreeItems } from '../cm/treeItemsXml';
import { readWorkspaceStatus } from '../cm/workspaceStatus';

/**
 * The plan with the repository of each conflicting file. `cm merge` prints a file under a writable xlink with the
 * xlinked repository's item id and changesets, never the repository, and `itemid:27#cs:12` reads the merged one's
 * item 27, another file. One `cm ls` of the conflicting files in the destination's tree reads each one's (it crosses
 * xlinks), and only when some file conflicts.
 */
export async function withConflictRepositories(cm: CmClient, workspacePath: string, request: MergeRequest, plan: PrintedMergePlan): Promise<MergePlan> {
  if (plan.fileConflicts.length === 0) return withRepositories(plan, '');
  const tree = destinationTree(request, plan) ?? spec.changeset((await readWorkspaceStatus(cm, workspacePath)).loadedChangeset);
  return withRepositories(plan, await cm.query(conflictListingArgs(plan, tree), { cwd: workspacePath }));
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

/** `cm ls` of the conflicting files in `tree`. */
export function conflictListingArgs(plan: PrintedMergePlan, tree: string): string[] {
  return ['ls', ...plan.fileConflicts.map((conflict) => conflict.path), `--tree=${tree}`, '--xml'];
}

/** Completes the plan's conflicts with the repositories `cm ls --xml` listed for their paths. */
export function withRepositories(plan: PrintedMergePlan, listingXml: string): MergePlan {
  const repositories = new Map(listingXml ? parseTreeItems(listingXml).map((item) => [item.path, item.repository]) : []);
  return {
    ...plan,
    fileConflicts: plan.fileConflicts.map((conflict) => {
      const repository = repositories.get(conflict.path.replace(/^\//, ''));
      if (!repository) throw new Error(`Couldn't tell which repository ${conflict.path} is in.`);
      return { ...conflict, repository };
    }),
  };
}
