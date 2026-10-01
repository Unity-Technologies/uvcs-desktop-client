import { beforeEach, describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({
  switchesTo: [] as string[],
  switchSucceeds: true,
  openedMerges: [] as unknown[],
}));

vi.mock('../branches/branchOperations', () => ({
  switchToBranch: async (_workspacePath: string, branch: string) => {
    recorded.switchesTo.push(branch);
    return recorded.switchSucceeds;
  },
}));
vi.mock('../merge/mergeOperations', () => ({ openMerge: (request: unknown) => recorded.openedMerges.push(request) }));

import { mergeDestinationIntoTask, resolveOnDestination } from './resolveTaskInWorkspace';

const ws = '/ws';

beforeEach(() => {
  Object.assign(recorded, { switchesTo: [], switchSucceeds: true, openedMerges: [] });
});

describe('resolving a task in the workspace', () => {
  it('brings the destination into the task, switching to the task first when needed', async () => {
    await mergeDestinationIntoTask(ws, '/main', '/main/task001', '/main');
    await mergeDestinationIntoTask(ws, '/main/task001', '/main/task001', '/main');
    expect(recorded.switchesTo).toEqual(['/main/task001']);
    expect(recorded.openedMerges).toEqual([
      { kind: 'merge', sourceSpec: 'br:/main' },
      { kind: 'merge', sourceSpec: 'br:/main' },
    ]);
  });

  it('merges the task into the destination, and opens nothing when the switch fails', async () => {
    await resolveOnDestination(ws, '/main/task001', 'br:/main/task001', '/main');
    recorded.switchSucceeds = false;
    await resolveOnDestination(ws, '/main/task001', 'br:/main/task001', '/main');
    expect(recorded.switchesTo).toEqual(['/main', '/main']);
    expect(recorded.openedMerges).toEqual([{ kind: 'merge', sourceSpec: 'br:/main/task001' }]);
  });
});
