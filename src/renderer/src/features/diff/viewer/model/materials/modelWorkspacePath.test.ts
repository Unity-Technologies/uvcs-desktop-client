import { describe, expect, it } from 'vitest';
import { modelWorkspacePath } from './modelWorkspacePath';

describe('modelWorkspacePath', () => {
  it("is where the workspace has the model: a workspace file's path, a repository path without its root", () => {
    expect(modelWorkspacePath({ kind: 'workspaceFile', path: 'Assets\\Art\\Tree.fbx' }, 'game@local')).toBe('Assets/Art/Tree.fbx');
    expect(modelWorkspacePath({ kind: 'repositoryPath', path: '/Assets/Tree.fbx', at: 'cs:4' }, 'game@local')).toBe('Assets/Tree.fbx');
    expect(modelWorkspacePath({ kind: 'spec', spec: 'serverpath:/Assets/Tree.fbx#cs:4' }, 'game@local')).toBe('Assets/Tree.fbx');
    expect(modelWorkspacePath({ kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'Assets/Tree.fbx' }, 'game@local')).toBe('Assets/Tree.fbx');
  });

  it("is nowhere for a revision of another repository: its path names another tree's folder", () => {
    expect(modelWorkspacePath({ kind: 'revision', revision: { revisionId: 4, repository: 'art@local' }, fileName: 'Assets/Tree.fbx' }, 'game@local')).toBeNull();
    expect(modelWorkspacePath({ kind: 'empty' }, 'game@local')).toBeNull();
  });
});
