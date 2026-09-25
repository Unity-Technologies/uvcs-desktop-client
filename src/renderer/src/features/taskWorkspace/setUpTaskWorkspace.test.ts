import { describe, expect, it, vi } from 'vitest';
import { describeTaskFailure, setUpTaskWorkspace, taskSteps, type TaskWorkspaceActions, type TaskWorkspacePlan } from './setUpTaskWorkspace';

const plan: TaskWorkspacePlan = {
  repository: 'game@local',
  branch: '/main/task-12',
  newBranch: true,
  workspaceName: 'game-task-12',
  folder: '/wk/game-task-12',
};

function actions(failing?: keyof TaskWorkspaceActions): TaskWorkspaceActions & { calls: string[] } {
  const calls: string[] = [];
  const step = (name: keyof TaskWorkspaceActions, result?: unknown) =>
    vi.fn(async (...args: unknown[]) => {
      calls.push(`${name} ${args.join(' ')}`);
      if (name === failing) throw new Error(`${name} failed`);
      return result as never;
    });
  return {
    calls,
    createBranch: step('createBranch'),
    createWorkspace: step('createWorkspace', '/private/wk/game-task-12'),
    switchTo: step('switchTo'),
    discardWorkspace: step('discardWorkspace'),
  };
}

describe('setUpTaskWorkspace', () => {
  it('creates the branch, then the workspace, then switches it', async () => {
    const steps: string[] = [];
    const run = actions();
    const outcome = await setUpTaskWorkspace(plan, run, (step, state) => steps.push(`${step}:${state}`));

    expect(outcome).toEqual({ kind: 'ready', workspacePath: '/private/wk/game-task-12' });
    expect(run.calls).toEqual([
      'createBranch /main/task-12',
      'createWorkspace game-task-12 /wk/game-task-12 game@local',
      'switchTo /private/wk/game-task-12 /main/task-12',
    ]);
    expect(steps).toEqual(['branch:running', 'branch:done', 'workspace:running', 'workspace:done', 'switch:running', 'switch:done']);
  });

  it('skips the branch step for an existing branch', async () => {
    const run = actions();
    await setUpTaskWorkspace({ ...plan, newBranch: false }, run, () => undefined);
    expect(run.calls[0]).toMatch(/^createWorkspace/);
    expect(taskSteps(false)).toEqual(['workspace', 'switch']);
  });

  it('stops at a branch that can’t be created, with nothing to undo', async () => {
    const run = actions('createBranch');
    const outcome = await setUpTaskWorkspace(plan, run, () => undefined);
    expect(outcome).toMatchObject({ kind: 'failed', step: 'branch', keptBranch: undefined, discarded: undefined });
    expect(run.calls).toHaveLength(1);
  });

  it('removes the workspace when the switch fails, and keeps the branch', async () => {
    const steps: string[] = [];
    const run = actions('switchTo');
    const outcome = await setUpTaskWorkspace(plan, run, (step, state) => steps.push(`${step}:${state}`));

    expect(run.calls.at(-1)).toBe('discardWorkspace /private/wk/game-task-12');
    expect(steps.at(-1)).toBe('switch:failed');
    expect(outcome).toMatchObject({ kind: 'failed', step: 'switch', keptBranch: '/main/task-12', discarded: { removed: true } });
    expect(describeTaskFailure(outcome as never)).toBe(
      "Couldn't switch the new workspace to the branch. The new workspace was removed. The branch /main/task-12 was created and is kept.",
    );
  });

  it('says so when the half-created workspace can’t be removed', async () => {
    const run = actions('switchTo');
    run.discardWorkspace = vi.fn(async () => {
      throw new Error('locked');
    });
    const outcome = await setUpTaskWorkspace({ ...plan, newBranch: false }, run, () => undefined);
    expect(describeTaskFailure(outcome as never)).toBe(
      "Couldn't switch the new workspace to the branch. The new workspace at /private/wk/game-task-12 couldn't be removed; remove it from the workspaces list.",
    );
  });

  it('keeps the branch when the workspace can’t be created', async () => {
    const outcome = await setUpTaskWorkspace(plan, actions('createWorkspace'), () => undefined);
    expect(describeTaskFailure(outcome as never)).toBe("Couldn't create the workspace. The branch /main/task-12 was created and is kept.");
  });
});
