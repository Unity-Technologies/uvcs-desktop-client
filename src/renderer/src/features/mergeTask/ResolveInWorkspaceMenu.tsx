import { ChevronDown, GitBranch, GitMerge } from 'lucide-react';
import { navigation } from '../../app/navigation/navigationStore';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { DescribedMenu } from '../../ui/menu/DescribedMenu';
import { workspaceResolutions, type ConflictPath } from './conflictPaths';
import { mergeDestinationIntoTask, resolveOnDestination } from './resolveTaskInWorkspace';
import type { TaskMerge } from './taskMerge';

interface ResolveInWorkspaceMenuProps {
  workspacePath: string;
  /** What the page merges into `destination`, a branch on the server. */
  sourceSpec: string;
  destination: string;
  task: TaskMerge;
}

/**
 * The merge page's way out of resolving a task's conflicts on the server: in the workspace, by merging the destination
 * into the task first or by merging the task on the destination. Either leaves the page for the merge it opens.
 */
export function ResolveInWorkspaceMenu({ workspacePath, sourceSpec, destination, task }: ResolveInWorkspaceMenuProps) {
  const { data: workspace } = useWorkspaceInfo();
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;
  const taskBranch = task.branch.name;

  const resolve = (path: ConflictPath): void => {
    navigation.goBack();
    if (path === 'intoTask') void mergeDestinationIntoTask(workspacePath, currentBranch, taskBranch, destination);
    else void resolveOnDestination(workspacePath, currentBranch, sourceSpec, destination);
  };

  const items = workspaceResolutions({ sourceSpec, taskBranch, destination, currentBranch }).map((way) => ({
    id: way.path,
    label: way.label,
    description: way.description,
    tip: way.tip,
    icon: way.path === 'intoTask' ? GitBranch : GitMerge,
    run: () => resolve(way.path),
  }));

  return (
    <DescribedMenu items={items}>
      <Button>
        Resolve in the workspace instead
        <ChevronDown size={13} />
      </Button>
    </DescribedMenu>
  );
}
