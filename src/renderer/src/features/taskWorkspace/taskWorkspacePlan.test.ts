import { describe, expect, it } from 'vitest';
import { taskWorkspacePlan } from './taskWorkspacePlan';

type Choices = Parameters<typeof taskWorkspacePlan>[0];

const newBranch: Choices = {
  repository: 'game@local',
  mode: 'new',
  branch: '/main/task-0927-1200',
  branchError: undefined,
  folder: '/wk/game-task-0927-1200',
  workspaceName: 'game-task-0927-1200',
  folderCheck: 'available',
  typedExists: false,
  running: false,
};

describe('taskWorkspacePlan', () => {
  it('creates a new branch, a workspace in the folder, and switches it', () => {
    expect(taskWorkspacePlan(newBranch)).toEqual({
      repository: 'game@local',
      branch: '/main/task-0927-1200',
      newBranch: true,
      workspaceName: 'game-task-0927-1200',
      folder: '/wk/game-task-0927-1200',
    });
  });

  it('works on a new branch whose name is taken as on an existing one', () => {
    expect(taskWorkspacePlan({ ...newBranch, typedExists: true })).toMatchObject({ newBranch: false });
  });

  it('waits to know whether the name typed is taken', () => {
    expect(taskWorkspacePlan({ ...newBranch, typedExists: undefined })).toBeNull();
  });

  it('never waits for that on an existing branch', () => {
    expect(taskWorkspacePlan({ ...newBranch, mode: 'existing', typedExists: undefined })).toMatchObject({ newBranch: false });
  });

  it('can’t create with an invalid name, no branch picked, or before the repository is known', () => {
    expect(taskWorkspacePlan({ ...newBranch, branchError: 'Names can’t contain @' })).toBeNull();
    expect(taskWorkspacePlan({ ...newBranch, mode: 'existing', branch: undefined })).toBeNull();
    expect(taskWorkspacePlan({ ...newBranch, repository: undefined })).toBeNull();
  });

  it('can’t create in a folder that isn’t free, or before the folder was checked', () => {
    expect(taskWorkspacePlan({ ...newBranch, folderCheck: 'notEmpty' })).toBeNull();
    expect(taskWorkspacePlan({ ...newBranch, folderCheck: 'notAFolder' })).toBeNull();
    expect(taskWorkspacePlan({ ...newBranch, folderCheck: undefined })).toBeNull();
    expect(taskWorkspacePlan({ ...newBranch, folder: '', workspaceName: '' })).toBeNull();
  });
});
