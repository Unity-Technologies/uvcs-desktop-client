export type TaskStep = 'branch' | 'workspace' | 'switch';
export type TaskStepState = 'running' | 'done' | 'failed';

export interface TaskWorkspacePlan {
  /** Repository spec, `name@server`. */
  repository: string;
  /** Full branch name, e.g. `/main/task-12`. */
  branch: string;
  /** Create the branch first (a new child of /main at its head), or use an existing one. */
  newBranch: boolean;
  workspaceName: string;
  folder: string;
}

/** The `cm` work behind each step, injected so the order and the rollback can be tested. */
export interface TaskWorkspaceActions {
  createBranch: (branch: string) => Promise<void>;
  /** Resolves with the new workspace's path. */
  createWorkspace: (name: string, folder: string, repository: string) => Promise<string>;
  switchTo: (workspacePath: string, branch: string) => Promise<void>;
  /** Unregisters the half-created workspace and deletes its folder. */
  discardWorkspace: (workspacePath: string) => Promise<void>;
}

export type TaskWorkspaceOutcome =
  | { kind: 'ready'; workspacePath: string }
  | {
      kind: 'failed';
      step: TaskStep;
      error: unknown;
      /** The new branch, created before the failure: it's kept. */
      keptBranch?: string;
      /** The workspace created before the failure, and whether it could be removed. */
      discarded?: { workspacePath: string; removed: boolean };
    };

/** The steps a plan goes through, in order. */
export function taskSteps(newBranch: boolean): TaskStep[] {
  return newBranch ? ['branch', 'workspace', 'switch'] : ['workspace', 'switch'];
}

/**
 * Creates the branch (if new), creates the workspace, and switches it to the branch; the workspace is clean, so a
 * plain switch. A failure after the workspace exists removes it again (nothing of the user's is in it); a branch
 * created on the way is kept, since others may already see it.
 */
export async function setUpTaskWorkspace(
  plan: TaskWorkspacePlan,
  actions: TaskWorkspaceActions,
  onStep: (step: TaskStep, state: TaskStepState) => void,
): Promise<TaskWorkspaceOutcome> {
  let current: TaskStep = 'branch';
  let keptBranch: string | undefined;
  let workspacePath: string | undefined;
  const run = async <T,>(step: TaskStep, work: () => Promise<T>): Promise<T> => {
    current = step;
    onStep(step, 'running');
    const result = await work();
    onStep(step, 'done');
    return result;
  };

  try {
    if (plan.newBranch) {
      await run('branch', () => actions.createBranch(plan.branch));
      keptBranch = plan.branch;
    }
    workspacePath = await run('workspace', () => actions.createWorkspace(plan.workspaceName, plan.folder, plan.repository));
    const created = workspacePath;
    await run('switch', () => actions.switchTo(created, plan.branch));
    return { kind: 'ready', workspacePath: created };
  } catch (error) {
    onStep(current, 'failed');
    const discarded = workspacePath === undefined ? undefined : { workspacePath, removed: await tryDiscard(actions, workspacePath) };
    return { kind: 'failed', step: current, error, keptBranch, discarded };
  }
}

async function tryDiscard(actions: TaskWorkspaceActions, workspacePath: string): Promise<boolean> {
  try {
    await actions.discardWorkspace(workspacePath);
    return true;
  } catch {
    return false;
  }
}

const FAILED_STEP: Record<TaskStep, string> = {
  branch: "Couldn't create the branch.",
  workspace: "Couldn't create the workspace.",
  switch: "Couldn't switch the new workspace to the branch.",
};

/** What went wrong and what was left behind, in a sentence or two. */
export function describeTaskFailure(outcome: Extract<TaskWorkspaceOutcome, { kind: 'failed' }>): string {
  const parts = [FAILED_STEP[outcome.step]];
  if (outcome.discarded?.removed) parts.push('The new workspace was removed.');
  if (outcome.discarded && !outcome.discarded.removed) parts.push(`The new workspace at ${outcome.discarded.workspacePath} couldn't be removed; remove it from the workspaces list.`);
  if (outcome.keptBranch) parts.push(`The branch ${outcome.keptBranch} was created and is kept.`);
  return parts.join(' ');
}
