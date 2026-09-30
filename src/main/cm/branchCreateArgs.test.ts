import { describe, expect, it } from 'vitest';
import { branchCreateArgs } from './branchCreateArgs';

describe('branchCreateArgs', () => {
  it('starts a branch at a changeset, a label, or the head of its parent', () => {
    expect(branchCreateArgs({ name: '/main/task', startingPoint: 'cs:12' }, 'c.txt')).toEqual(['branch', 'create', '/main/task', '--changeset=cs:12', '-commentsfile=c.txt']);
    expect(branchCreateArgs({ name: '/main/task', startingPoint: 'lb:v1.0' }, 'c.txt')).toEqual(['branch', 'create', '/main/task', '--label=lb:v1.0', '-commentsfile=c.txt']);
    expect(branchCreateArgs({ name: '/main/task' }, 'c.txt')).toEqual(['branch', 'create', '/main/task', '-commentsfile=c.txt']);
  });

  it('refuses any other starting point', () => {
    expect(() => branchCreateArgs({ name: '/main/task', startingPoint: 'sh:3' }, 'c.txt')).toThrow('A branch can only start at a changeset or a label');
  });
});
