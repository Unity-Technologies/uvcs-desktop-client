import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { branchCreateArgs } from './branchCreateArgs';
import { cmPlace } from './cmPlace';

const inWorkspace = cmPlace(workspacePlace('/wk'));

describe('branchCreateArgs', () => {
  it('starts a branch at a changeset, a label, or the head of its parent', () => {
    expect(branchCreateArgs({ name: '/main/task', startingPoint: 'cs:12' }, 'c.txt', inWorkspace)).toEqual(['branch', 'create', '/main/task', '--changeset=cs:12', '-commentsfile=c.txt']);
    expect(branchCreateArgs({ name: '/main/task', startingPoint: 'lb:v1.0' }, 'c.txt', inWorkspace)).toEqual(['branch', 'create', '/main/task', '--label=lb:v1.0', '-commentsfile=c.txt']);
    expect(branchCreateArgs({ name: '/main/task' }, 'c.txt', inWorkspace)).toEqual(['branch', 'create', '/main/task', '-commentsfile=c.txt']);
  });

  it('refuses any other starting point', () => {
    expect(() => branchCreateArgs({ name: '/main/task', startingPoint: 'sh:3' }, 'c.txt', inWorkspace)).toThrow('A branch can only start at a changeset or a label');
  });

  it('names the repository on the new branch and its starting point when no workspace tells cm which', () => {
    const onRepository = cmPlace(repositoryPlace('game@local'));
    expect(branchCreateArgs({ name: '/main/task', startingPoint: 'cs:12' }, 'c.txt', onRepository)).toEqual([
      'branch',
      'create',
      'br:/main/task@game@local',
      '--changeset=cs:12@game@local',
      '-commentsfile=c.txt',
    ]);
    expect(branchCreateArgs({ name: '/main/task', startingPoint: 'lb:v1.0' }, 'c.txt', onRepository)[3]).toBe('--label=lb:v1.0@game@local');
  });
});
