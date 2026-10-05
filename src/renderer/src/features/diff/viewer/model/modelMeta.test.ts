import { describe, expect, it } from 'vitest';
import { modelBesideMeta, modelOfMeta } from './modelMeta';
import { workspaceSibling } from './modelSiblings';

describe('modelOfMeta', () => {
  it("names the model a model's .meta belongs to, whatever the case", () => {
    expect(modelOfMeta('Assets/Characters/Hero.FBX.meta')).toBe('Assets/Characters/Hero.FBX');
    expect(modelOfMeta('Assets\\Props\\Barrel.gltf.meta')).toBe('Assets\\Props\\Barrel.gltf');
  });

  it("is nothing for another asset's .meta, or a model itself", () => {
    expect(modelOfMeta('Assets/Textures/Wood.png.meta')).toBeNull();
    expect(modelOfMeta('Assets/Hero.fbx')).toBeNull();
  });
});

describe('modelBesideMeta', () => {
  it("finds the model beside each side of a workspace model's .meta", () => {
    expect(modelBesideMeta(workspaceSibling, { original: { kind: 'workspaceBase', path: 'Assets/Hero.fbx.meta' }, modified: { kind: 'workspaceFile', path: 'Assets/Hero.fbx.meta' } })).toEqual({
      original: { kind: 'workspaceBase', path: 'Assets/Hero.fbx' },
      modified: { kind: 'workspaceFile', path: 'Assets/Hero.fbx' },
    });
  });

  it('finds none where the sources name no folder to look in, so the .meta shows as text', () => {
    const revision = { kind: 'revision' as const, revision: { revisionId: 4, repository: 'game@local' }, fileName: 'Assets/Hero.fbx.meta' };
    expect(modelBesideMeta(workspaceSibling, { original: revision, modified: revision })).toBeNull();
  });

  it("finds the one side there is, of a .meta added with its model", () => {
    expect(modelBesideMeta(workspaceSibling, { original: { kind: 'empty' }, modified: { kind: 'workspaceFile', path: 'Hero.glb.meta' } })).toEqual({ original: null, modified: { kind: 'workspaceFile', path: 'Hero.glb' } });
  });
});
