import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { describeProgress } from '../../app/operations/describeProgress';
import { nextProgressBar, SWEEP } from '../../app/operations/progressBar';
import { invalidateWorkspace, queryClient } from '../../app/queryClient';
import { isAffectedByBranchList } from '../../app/refresh/refreshScopes';
import { describeTaskFailure, setUpTaskWorkspace, taskSteps, type TaskStep, type TaskStepState, type TaskWorkspaceOutcome, type TaskWorkspacePlan } from './setUpTaskWorkspace';
import { taskWorkspaceActions } from './taskWorkspaceActions';
import type { TaskStepProgress } from './TaskStepList';

/** The steps of a set-up as the dialog lists them, and how each stands. */
export interface TaskSetupSteps {
  steps: TaskStep[];
  states: Partial<Record<TaskStep, TaskStepState>>;
  labels: Record<TaskStep, string>;
  /** The switch's progress, while it runs. */
  switchProgress: TaskStepProgress | null;
}

interface TaskWorkspaceSetup {
  running: boolean;
  /** Undefined until the first set-up starts. */
  progress: TaskSetupSteps | undefined;
  failure: { message: string; reason: string } | null;
  /** Only the switch can stop: the other steps are quick. */
  canStop: boolean;
  /** Sets the workspace up, step by step; the outcome once done, and the workspace lists refreshed. */
  start: (plan: TaskWorkspacePlan) => Promise<TaskWorkspaceOutcome>;
  /** Stops the switch (the new workspace is then removed). */
  stop: () => void;
}

/** A task workspace being set up from `workspacePath`: its steps as they go, and a failure's explanation. */
export function useTaskWorkspaceSetup(workspacePath: string): TaskWorkspaceSetup {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<TaskSetupSteps>();
  const [failure, setFailure] = useState<{ message: string; reason: string } | null>(null);
  const operationId = useRef<string | null>(null);

  const start = async (plan: TaskWorkspacePlan): Promise<TaskWorkspaceOutcome> => {
    setRunning(true);
    setFailure(null);
    setProgress({
      steps: taskSteps(plan.newBranch),
      states: {},
      labels: { branch: `Create branch ${plan.branch}`, workspace: `Create workspace ${plan.workspaceName}`, switch: `Switch it to ${plan.branch}` },
      switchProgress: null,
    });
    const update = (change: (current: TaskSetupSteps) => Partial<TaskSetupSteps>): void =>
      setProgress((current) => current && { ...current, ...change(current) });
    operationId.current = crypto.randomUUID();
    const actions = taskWorkspaceActions(workspacePath, operationId.current, (reported) =>
      update((current) => ({
        switchProgress: { text: describeProgress(reported), bar: nextProgressBar(current.switchProgress?.bar ?? SWEEP, reported, performance.now()) },
      })),
    );
    const outcome = await setUpTaskWorkspace(plan, actions, (step, state) => update((current) => ({ states: { ...current.states, [step]: state } })));
    operationId.current = null;
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
    if (plan.newBranch) void invalidateWorkspace(workspacePath, isAffectedByBranchList);
    setRunning(false);
    if (outcome.kind === 'failed') {
      setFailure({ message: describeTaskFailure(outcome), reason: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) });
    }
    return outcome;
  };

  const canStop = running && progress?.states.switch === 'running';
  const stop = (): void => {
    if (canStop && operationId.current) void api.system.cancelOperation(operationId.current);
  };

  return { running, progress, failure, canStop, start, stop };
}
