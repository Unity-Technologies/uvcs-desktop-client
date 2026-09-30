import { describe, expect, it } from 'vitest';
import type { Action } from '../../lib/actions';
import { syncBranchMenu } from './syncBranchMenu';

const done: string[] = [];
const sync = { push: (branch: string) => done.push(`push ${branch}`), pull: (branch: string) => done.push(`pull ${branch}`) };
const task = { name: '/main/task' };

describe('syncBranchMenu', () => {
  it('pushes the branch to the other repository or pulls its version from there, naming it', () => {
    const menu = syncBranchMenu([task], 'game@cloud', sync) as Action[];

    expect(menu.map((entry) => entry.label)).toEqual(['Push to game@cloud', 'Pull from game@cloud']);
    menu.forEach((entry) => entry.run());
    expect(done).toEqual(['push /main/task', 'pull /main/task']);
  });

  it('offers nothing for several branches, or before the other repository is picked', () => {
    expect(syncBranchMenu([task, { name: '/main' }], 'game@cloud', sync)).toEqual([]);
    expect(syncBranchMenu([task], null, sync)).toEqual([]);
  });
});
