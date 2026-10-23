import { describe, expect, it } from 'vitest';
import { MAIN_BRANCH_GUID, type Branch } from '@shared/domain/branch';
import { filesBranchCaption, shownFilesBranch } from './shownFilesBranch';

const branch = (name: string, headChangeset: number, guid = `guid-${name}`): Branch => ({
  id: headChangeset,
  name,
  parent: '',
  comment: '',
  owner: 'ana',
  date: '',
  headChangeset,
  guid,
  repository: 'game@local',
});

const main = branch('/main', 12, MAIN_BRANCH_GUID.toUpperCase());
const task = branch('/main/task', 15);

describe('shownFilesBranch', () => {
  it('shows the main branch by default, found by its GUID whatever it is named', () => {
    expect(shownFilesBranch([task, main], undefined)).toBe(main);
    const renamed = { ...main, name: '/trunk' };
    expect(shownFilesBranch([task, renamed], undefined)).toBe(renamed);
  });

  it('shows the branch chosen, and the main branch again once the chosen one is gone', () => {
    expect(shownFilesBranch([main, task], '/main/task')).toBe(task);
    expect(shownFilesBranch([main], '/main/task')).toBe(main);
  });

  it('shows the first branch listed in a repository whose main branch is not listed, and none before the branches are read', () => {
    expect(shownFilesBranch([task], undefined)).toBe(task);
    expect(shownFilesBranch(undefined, undefined)).toBeNull();
    expect(shownFilesBranch([], '/main')).toBeNull();
  });
});

describe('filesBranchCaption', () => {
  it("names the branch and the changeset its latest tree is", () => {
    expect(filesBranchCaption(main)).toBe('Latest of /main · changeset 12');
  });
});
