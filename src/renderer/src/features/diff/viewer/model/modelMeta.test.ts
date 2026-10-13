import { describe, expect, it } from 'vitest';
import { modelBesideMeta, modelOfMeta, modelReadsOfSides } from './modelMeta';
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

describe('modelReadsOfSides', () => {
  const model = { kind: 'revision' as const, revision: { revisionId: 4, repository: 'game@local' }, fileName: 'Assets/Hero.fbx' };

  it("reads the model once when the .meta changed and the model didn't, both sides showing that one read", () => {
    expect(modelReadsOfSides({ original: model, modified: { ...model, revision: { ...model.revision } } })).toEqual({ reads: [model], readOf: { original: 0, modified: 0 } });
  });

  it('reads each version of a model that changed with its .meta', () => {
    const changed = { ...model, revision: { revisionId: 9, repository: 'game@local' } };
    expect(modelReadsOfSides({ original: model, modified: changed })).toEqual({ reads: [model, changed], readOf: { original: 0, modified: 1 } });
  });

  it('reads no model for a side without one, as an empty read of its own', () => {
    expect(modelReadsOfSides({ original: null, modified: model })).toEqual({ reads: [null, model], readOf: { original: 0, modified: 1 } });
    expect(modelReadsOfSides({ original: null, modified: null })).toEqual({ reads: [null], readOf: { original: 0, modified: 0 } });
  });
});
