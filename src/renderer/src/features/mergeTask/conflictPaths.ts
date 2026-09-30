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

/** The two ways, as the dialog offers them; each says whether the workspace switches first. */
export function conflictPathCards(taskBranch: string, destination: string, currentBranch: string | undefined): ConflictPathCard[] {
  return [
    {
      value: 'intoTask',
      title: `Merge ${destination} into ${taskBranch} first`,
      description: `Resolve on the task branch${currentBranch === taskBranch ? '' : ' (the workspace switches to it)'}, check in, and merge the task again: it will be clean.`,
    },
    {
      value: 'onDestination',
      title: `Resolve on ${destination} in this workspace`,
      description: `${currentBranch === destination ? 'Merge' : `Switch to ${destination} and merge`} ${taskBranch} there; checking in finishes the task.`,
    },
  ];
}

/** The dialog's primary button while the task conflicts. */
export function resolveButtonLabel(path: ConflictPath, taskBranch: string, destination: string): string {
  return path === 'intoTask' ? `Merge ${destination} into ${taskBranch}` : `Resolve on ${destination}`;
}
