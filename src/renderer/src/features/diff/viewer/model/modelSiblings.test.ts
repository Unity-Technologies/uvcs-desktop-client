import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { diffSibling, sourcePathOf, workspaceSibling } from './modelSiblings';

const entry = (path: string, baseRevisionId: number, revisionId: number): DiffEntry => ({ status: 'changed', path, itemType: 'file', baseRevisionId, revisionId, repository: 'game@local' });

describe('workspaceSibling', () => {
  it('finds the file beside a workspace file, on disk or as loaded', () => {
    expect(workspaceSibling('modified', { kind: 'workspaceFile', path: 'Assets/Props/Barrel.gltf' }, 'Assets/Props/Barrel.gltf', 'Barrel.bin')).toEqual({ kind: 'workspaceFile', path: 'Assets/Props/Barrel.bin' });
    expect(workspaceSibling('original', { kind: 'workspaceBase', path: 'Barrel.gltf' }, 'Barrel.gltf', 'buffers/Barrel.bin')).toEqual({ kind: 'workspaceBase', path: 'buffers/Barrel.bin' });
  });

  it("keeps a Windows path's separators", () => {
    expect(workspaceSibling('modified', { kind: 'workspaceFile', path: 'Assets\\Props\\Barrel.gltf' }, 'Assets\\Props\\Barrel.gltf', 'Barrel.bin')).toEqual({ kind: 'workspaceFile', path: 'Assets\\Props\\Barrel.bin' });
  });

  it('never reaches above the folder, nor to an absolute path', () => {
    for (const name of ['../secrets.bin', '/etc/passwd', 'C:\\Windows\\x.bin', 'a//b.bin']) {
      expect(workspaceSibling('modified', { kind: 'workspaceFile', path: 'Assets/Barrel.gltf' }, 'Assets/Barrel.gltf', name)).toBeNull();
    }
  });

  it('finds none for a source that names no place', () => {
    expect(workspaceSibling('modified', { kind: 'spec', spec: 'revid:4@game@local' }, 'Barrel.gltf', 'Barrel.bin')).toBeNull();
  });
});

describe('diffSibling', () => {
  const gltf = { kind: 'revision' as const, revision: { revisionId: 11, repository: 'game@local' }, fileName: 'Assets/Barrel.gltf' };

  it("takes the sibling's revisions on each side from its entry, when the diff changed it too", () => {
    const find = diffSibling([entry('Assets/Barrel.gltf', 10, 11), entry('Assets/Barrel.bin', 20, 21)], { kind: 'changeset', changesetId: 7 }, 'game@local');
    expect(find('original', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toEqual({ kind: 'revision', revision: { revisionId: 20, repository: 'game@local' }, fileName: 'Assets/Barrel.bin' });
    expect(find('modified', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toEqual({ kind: 'revision', revision: { revisionId: 21, repository: 'game@local' }, fileName: 'Assets/Barrel.bin' });
  });

  it('reads a sibling the diff left alone where the diff points to: the same on both sides', () => {
    const entries = [entry('Assets/Barrel.gltf', 10, 11)];
    expect(diffSibling(entries, { kind: 'changeset', changesetId: 7 }, 'game@local')('original', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toEqual({ kind: 'repositoryPath', path: '/Assets/Barrel.bin', at: 'cs:7' });
    expect(diffSibling(entries, { kind: 'branch', branch: '/main/art' }, 'game@local')('modified', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toMatchObject({ at: 'br:/main/art' });
    expect(diffSibling(entries, { kind: 'shelve', shelveId: 3 }, 'game@local')('modified', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toMatchObject({ at: 'sh:3' });
    expect(diffSibling(entries, { kind: 'range', fromSpec: 'lb:v1.0', toSpec: 'lb:v1.1' }, 'game@local')('modified', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toMatchObject({ at: 'lb:v1.1' });
  });

  describe('of a model under an xlink', () => {
    const shared = { kind: 'revision' as const, revision: { revisionId: 23, repository: 'art@local' }, fileName: 'Assets/Shared/scene.gltf' };
    const entries = [{ ...entry('Assets/Shared/scene.gltf', 13, 23), repository: 'art@local' }];

    it('reads a sibling the diff left alone in the xlinked repository, through the tree where the diff points to', () => {
      expect(diffSibling(entries, { kind: 'changeset', changesetId: 7 }, 'game@local')('modified', shared, 'Assets/Shared/scene.gltf', 'scene.bin')).toEqual({ kind: 'repositoryPath', path: '/Assets/Shared/scene.bin', at: 'cs:7', repository: 'art@local' });
      expect(diffSibling(entries, { kind: 'branch', branch: '/main/art' }, 'game@local')('original', shared, 'Assets/Shared/scene.gltf', 'scene.bin')).toMatchObject({ at: 'br:/main/art', repository: 'art@local' });
    });

    it("finds none in a shelve or at a label, whose trees cm ls can't list", () => {
      expect(diffSibling(entries, { kind: 'shelve', shelveId: 3 }, 'game@local')('modified', shared, 'Assets/Shared/scene.gltf', 'scene.bin')).toBeNull();
      expect(diffSibling(entries, { kind: 'range', fromSpec: 'lb:v1.0', toSpec: 'lb:v1.1' }, 'game@local')('modified', shared, 'Assets/Shared/scene.gltf', 'scene.bin')).toBeNull();
    });

    it("reads one of the workspace's repository by its path, and any while the workspace's repository is unknown", () => {
      expect(diffSibling([entry('Assets/Barrel.gltf', 10, 11)], { kind: 'changeset', changesetId: 7 }, 'game@local')('modified', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toEqual({ kind: 'repositoryPath', path: '/Assets/Barrel.bin', at: 'cs:7' });
      expect(diffSibling(entries, { kind: 'changeset', changesetId: 7 }, undefined)('modified', shared, 'Assets/Shared/scene.gltf', 'scene.bin')).toEqual({ kind: 'repositoryPath', path: '/Assets/Shared/scene.bin', at: 'cs:7' });
    });
  });

  it("finds a moved model's siblings, moved with it, by their old path on the side before", () => {
    const moved = (path: string, oldPath: string, base: number, revision: number): DiffEntry => ({ ...entry(path, base, revision), status: 'moved', oldPath });
    const find = diffSibling([moved('Assets/New/Hero.fbx', 'Assets/Old/Hero.fbx', 10, 11), moved('Assets/New/Hero.fbx.meta', 'Assets/Old/Hero.fbx.meta', 20, 21)], { kind: 'changeset', changesetId: 7 }, 'game@local');
    const before = { kind: 'revision' as const, revision: { revisionId: 10, repository: 'game@local' }, fileName: 'Assets/Old/Hero.fbx' };
    expect(find('original', before, 'Assets/Old/Hero.fbx', 'Hero.fbx.meta')).toEqual({ kind: 'revision', revision: { revisionId: 20, repository: 'game@local' }, fileName: 'Assets/Old/Hero.fbx.meta' });
  });

  it('finds no side of a sibling added or deleted with the model', () => {
    const find = diffSibling([entry('Assets/Barrel.bin', -1, 21)], { kind: 'changeset', changesetId: 7 }, 'game@local');
    expect(find('original', gltf, 'Assets/Barrel.gltf', 'Barrel.bin')).toBeNull();
  });
});

describe('sourcePathOf', () => {
  it("is the path a side was read from, which its siblings are found beside, whatever the diff's file name says meanwhile", () => {
    expect(sourcePathOf({ kind: 'workspaceFile', path: 'Assets/Crate.fbx' })).toBe('Assets/Crate.fbx');
    expect(sourcePathOf({ kind: 'revision', revision: { revisionId: 4, repository: 'game@local' }, fileName: 'Assets/Crate.fbx' })).toBe('Assets/Crate.fbx');
    expect(sourcePathOf({ kind: 'repositoryPath', path: '/Assets/Crate.fbx', at: 'cs:3' })).toBe('/Assets/Crate.fbx');
    expect(sourcePathOf({ kind: 'spec', spec: 'serverpath:/Assets/Crate.fbx#cs:3' })).toBe('/Assets/Crate.fbx');
    expect(sourcePathOf({ kind: 'empty' })).toBeNull();
  });
});
