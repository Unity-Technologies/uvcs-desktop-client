import { describe, expect, it } from 'vitest';
import { defaultTaskFolder, suggestTaskBranchName, taskWorkspaceName } from './taskWorkspaceNaming';

describe('suggestTaskBranchName', () => {
  it('names the branch after the day and time', () => {
    expect(suggestTaskBranchName(new Date(2026, 8, 5, 9, 7))).toBe('task-0905-0907');
  });
});

describe('defaultTaskFolder', () => {
  it('puts the workspace next to the current one, named after the repository and the branch', () => {
    expect(defaultTaskFolder('/Users/me/wk/codice', 'codice', '/main/task-12')).toBe('/Users/me/wk/codice-task-12');
  });

  it('uses the last part of a nested repository name', () => {
    expect(defaultTaskFolder('/wk/unitymerge', 'codice/unitymerge', '/main/fix')).toBe('/wk/unitymerge-fix');
  });

  it('keeps Windows separators', () => {
    expect(defaultTaskFolder('C:\\wk\\game', 'game', '/main/ui')).toBe('C:\\wk\\game-ui');
  });
});

describe('taskWorkspaceName', () => {
  it('names the workspace after its folder, unique among the existing ones', () => {
    expect(taskWorkspaceName('/wk/codice-task-12', ['codice'])).toBe('codice-task-12');
    expect(taskWorkspaceName('/wk/codice-task-12', ['codice-task-12'])).toBe('codice-task-12-2');
  });
});
