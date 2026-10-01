import { branchLabels } from '../../lib/branchLabels';

/**
 * How to resolve a task's conflicts in the workspace: merge the destination into the task first, or merge the task on
 * the destination. A single changeset (the one a moved destination left beside its head) is only merged on it.
 */
export type ConflictPath = 'intoTask' | 'onDestination';

export interface ConflictPathCard {
  value: ConflictPath;
  title: string;
  description: string;
}

/**
 * The two ways, as the dialog offers them; each says whether the workspace switches first. The branches go by their own
 * names (`branchLabels`), as the dialog's title names them.
 */
export function conflictPathCards(taskBranch: string, destination: string, currentBranch: string | undefined): ConflictPathCard[] {
  const [task, parent] = branchLabels(taskBranch, destination);
  return [
    {
      value: 'intoTask',
      title: `Merge ${parent} into ${task} first`,
      description: `Resolve on the task branch${currentBranch === taskBranch ? '' : ' (the workspace switches to it)'}, check in, and merge the task again: it will be clean.`,
    },
    {
      value: 'onDestination',
      title: `Resolve on ${parent} in this workspace`,
      description: `${currentBranch === destination ? 'Merge' : `Switch to ${parent} and merge`} ${task} there; checking in finishes the task.`,
    },
  ];
}

/** The dialog's primary button while the task conflicts, naming the branches by their own names so it fits the dialog. */
export function resolveButtonLabel(path: ConflictPath, taskBranch: string, destination: string): string {
  const [task, parent] = branchLabels(taskBranch, destination);
  return resolveWords(path, task, parent);
}

/** The button's tooltip: the same words with the branches in full. */
export function resolveButtonTip(path: ConflictPath, taskBranch: string, destination: string): string {
  return resolveWords(path, taskBranch, destination);
}

function resolveWords(path: ConflictPath, task: string, destination: string): string {
  return path === 'intoTask' ? `Merge ${destination} into ${task}` : `Resolve on ${destination}`;
}
