import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import { taskWorkspaceActions } from './taskWorkspaceActions';

const progress = (fraction: number) => ({ fraction }) as unknown as OperationProgress;

describe('taskWorkspaceActions', () => {
  it('creates the branch from the current workspace, with no comment', async () => {
    fakeApi.answer('branches.create', () => undefined);

    await taskWorkspaceActions('/wk/game', 'op-1', () => {}).createBranch('/main/task-1');

    expect(fakeApi.argsOf('branches.create')).toEqual([['/wk/game', { name: '/main/task-1', comment: '' }]]);
  });

  it('creates the workspace in the folder and resolves to where it was created', async () => {
    fakeApi.answer('workspaces.create', () => ({ path: '/wk/game-task-1' }));

    expect(await taskWorkspaceActions('/wk/game', 'op-1', () => {}).createWorkspace('game-task-1', '/wk/game-task-1', 'game@local')).toBe('/wk/game-task-1');
    expect(fakeApi.argsOf('workspaces.create')).toEqual([[{ name: 'game-task-1', path: '/wk/game-task-1', repository: 'game@local' }]]);
  });

  it("reports the switch's own progress only, while it runs", async () => {
    const reported: OperationProgress[] = [];
    fakeApi.answer('workspaces.switchNewWorkspace', () => {
      fakeApi.emit('operationProgress', { operationId: 'op-1', progress: progress(0.5) });
      fakeApi.emit('operationProgress', { operationId: 'other', progress: progress(0.9) });
    });

    await taskWorkspaceActions('/wk/game', 'op-1', (each) => reported.push(each)).switchTo('/wk/game-task-1', '/main/task-1');
    fakeApi.emit('operationProgress', { operationId: 'op-1', progress: progress(1) });

    expect(reported).toEqual([progress(0.5)]);
    expect(fakeApi.argsOf('workspaces.switchNewWorkspace')).toEqual([['/wk/game-task-1', 'br:/main/task-1', 'op-1']]);
  });

  it('stops listening to progress when the switch fails too', async () => {
    const reported: OperationProgress[] = [];
    fakeApi.answer('workspaces.switchNewWorkspace', () => {
      throw new Error('Server unreachable');
    });

    await expect(taskWorkspaceActions('/wk/game', 'op-1', (each) => reported.push(each)).switchTo('/wk/game-task-1', '/main/task-1')).rejects.toThrow('Server unreachable');
    fakeApi.emit('operationProgress', { operationId: 'op-1', progress: progress(1) });

    expect(reported).toEqual([]);
  });
});
