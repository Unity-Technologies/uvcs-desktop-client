import { describe, expect, it } from 'vitest';
import { workspaceResolutions } from './conflictPaths';

const long = '/main/child-br-cr-sample/empty-branch2/child_1';
const task = { sourceSpec: `br:${long}/subtask`, taskBranch: `${long}/subtask`, destination: long };

describe('workspaceResolutions', () => {
  it('names the branches briefly and in full in the tips, saying the workspace switches when it is on neither', () => {
    expect(workspaceResolutions({ ...task, currentBranch: '/main' })).toEqual([
      {
        path: 'intoTask',
        label: 'Merge child_1 into subtask first',
        description: 'Switches to subtask. Resolve, check in, then merge again.',
        tip: `Merge ${long} into ${long}/subtask in this workspace`,
      },
      {
        path: 'onDestination',
        label: 'Merge on child_1 in this workspace',
        description: 'Switches to child_1. Checking in finishes the task.',
        tip: `Merge ${long}/subtask into ${long} in this workspace`,
      },
    ]);
  });

  it('says nothing of switching to the branch the workspace is on', () => {
    expect(workspaceResolutions({ ...task, currentBranch: task.taskBranch })[0]!.description).toBe('Resolve, check in, then merge again.');
    expect(workspaceResolutions({ ...task, currentBranch: long })[1]!.description).toBe('Checking in finishes the task.');
  });

  it('tells branches of the same last name apart', () => {
    expect(workspaceResolutions({ sourceSpec: 'br:/main/a/fix', taskBranch: '/main/a/fix', destination: '/main/b/fix', currentBranch: undefined })[0]!.label).toBe(
      'Merge b/fix into a/fix first',
    );
  });

  it('only merges on the destination the changeset a moved destination left', () => {
    expect(workspaceResolutions({ ...task, sourceSpec: 'cs:42', currentBranch: long })).toEqual([
      { path: 'onDestination', label: 'Merge on child_1 in this workspace', description: 'Checking in finishes the task.', tip: `Merge changeset 42 into ${long} in this workspace` },
    ]);
  });
});
