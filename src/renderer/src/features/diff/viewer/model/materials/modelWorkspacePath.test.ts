import { describe, expect, it } from 'vitest';
import { modelWorkspacePath } from './modelWorkspacePath';

describe('modelWorkspacePath', () => {
  it("is where the workspace has the model: a workspace file's path, a repository path without its root", () => {
    expect(modelWorkspacePath({ kind: 'workspaceFile', path: 'Assets\\Art\\Tree.fbx' }, 'game@local')).toBe('Assets/Art/Tree.fbx');
    expect(modelWorkspacePath({ kind: 'repositoryPath', path: '/Assets/Tree.fbx', at: 'cs:4' }, 'game@local')).toBe('Assets/Tree.fbx');
    expect(modelWorkspacePath({ kind: 'spec', spec: 'serverpath:/Assets/Tree.fbx#cs:4' }, 'game@local')).toBe('Assets/Tree.fbx');
    expect(modelWorkspacePath({ kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'Assets/Tree.fbx' }, 'game@local')).toBe('Assets/Tree.fbx');
  });

  it("is where the workspace has it for a revision of an xlinked repository too: its path holds the xlink's folder", () => {
    // Files' last change and a changeset diff name an item under an xlink by its workspace path (`cm ls`'s WkPath,
    // `cm diff`'s path), with the xlinked repository's revision.
    const underXlink = { kind: 'revision' as const, revision: { revisionId: 4, repository: 'art@local' }, fileName: 'Assets/Shared/Tree.fbx' };
    expect(modelWorkspacePath(underXlink, 'game@local')).toBe('Assets/Shared/Tree.fbx');
  });

  it('is nowhere for a source without a path', () => {
    expect(modelWorkspacePath({ kind: 'empty' }, 'game@local')).toBeNull();
  });
});
