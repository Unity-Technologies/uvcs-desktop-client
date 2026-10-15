import { describe, expect, it } from 'vitest';
import { metaModelView, modelBesideMeta, modelOfMeta, modelReadsOfSides } from './modelMeta';
import { historySibling, workspaceSibling } from './modelSiblings';

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

  it("finds the model beside each side of a .meta's history, as it was in each revision's changeset", () => {
    const revision = (revisionId: number) => ({ kind: 'revision' as const, revision: { revisionId, repository: 'game@local' }, fileName: 'Assets/Crate.fbx.meta' });
    const findSibling = historySibling({ changesets: { original: 21, modified: 22 }, inWorkspaceRepository: true });
    expect(modelBesideMeta(findSibling, { original: revision(40), modified: revision(41) })).toEqual({
      original: { kind: 'repositoryPath', path: '/Assets/Crate.fbx', at: 'cs:21', beside: { path: '/Assets/Crate.fbx.meta', revisionId: 40 } },
      modified: { kind: 'repositoryPath', path: '/Assets/Crate.fbx', at: 'cs:22', beside: { path: '/Assets/Crate.fbx.meta', revisionId: 41 } },
    });
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

describe('metaModelView', () => {
  it('shows the model where a side has it, a side without one empty: a .meta added with its model, or one whose model was elsewhere then', () => {
    expect(metaModelView({ original: 'model', modified: 'model' })).toBe('model');
    expect(metaModelView({ original: 'none', modified: 'model' })).toBe('model');
    expect(metaModelView({ original: 'absent', modified: 'model' })).toBe('model');
  });

  it("shows the .meta's text where neither side has its model beside it (in History, a .meta moved since)", () => {
    expect(metaModelView({ original: 'absent', modified: 'absent' })).toBe('text');
    expect(metaModelView({ original: 'none', modified: 'absent' })).toBe('text');
  });

  it("waits for every read, and fails only on a side that genuinely couldn't be read", () => {
    expect(metaModelView({ original: 'loading', modified: 'model' })).toBe('loading');
    expect(metaModelView({ original: 'failed', modified: 'model' })).toBe('failed');
    expect(metaModelView({ original: 'failed', modified: 'loading' })).toBe('loading');
  });
});
