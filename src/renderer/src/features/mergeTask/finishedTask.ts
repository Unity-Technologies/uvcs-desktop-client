import { create } from 'zustand';

/** A task branch merged into its destination: what the Changes view offers to do next. */
export interface FinishedTask {
  branch: string;
  destination: string;
  /** The changeset the merge created on the destination. */
  changesetId: number;
  hidden: boolean;
}

interface FinishedTasksStore {
  /** Tasks merged from this window, per workspace, until the workspace moves on. */
  merged: Record<string, FinishedTask>;
  /** Cards closed by the user, by `finishedTaskKey`. */
  dismissed: ReadonlySet<string>;
  remember: (workspacePath: string, task: FinishedTask) => void;
  dismiss: (task: FinishedTask) => void;
}

export const useFinishedTasksStore = create<FinishedTasksStore>((set) => ({
  merged: {},
  dismissed: new Set(),
  remember: (workspacePath, task) => set((state) => ({ merged: { ...state.merged, [workspacePath]: task } })),
  dismiss: (task) => set((state) => ({ dismissed: new Set(state.dismissed).add(finishedTaskKey(task)) })),
}));

export function finishedTaskKey(task: Pick<FinishedTask, 'branch' | 'changesetId'>): string {
  return `${task.branch}@${task.changesetId}`;
}

interface FinishedTaskInput {
  /** The branch the workspace is on. */
  branch: string;
  /**
   * Where the task merges: its merge request's destination, else its parent (`mergedCheckDestinationOf`); none when
   * it's no task branch still listed (a hidden branch isn't).
   */
  destination: string | undefined;
  /** Recorded when this window merged it. */
  merged: FinishedTask | undefined;
  /** Where the server says the branch head was merged into `destination`; undefined while asking. */
  mergedInto: number | null | undefined;
  dismissed: ReadonlySet<string>;
}

/**
 * The finished task to show for the workspace's branch: the merge made here, or the one the server knows of for the
 * branch head (someone merged it elsewhere, or before a restart); null when there's none or it was dismissed.
 */
export function finishedTaskFor({ branch, destination, merged, mergedInto, dismissed }: FinishedTaskInput): FinishedTask | null {
  const task =
    merged?.branch === branch
      ? merged
      : destination && typeof mergedInto === 'number'
        ? { branch, destination, changesetId: mergedInto, hidden: false }
        : null;
  return task && !dismissed.has(finishedTaskKey(task)) ? task : null;
}
