import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { MAX_CHANGED_ASSETS } from '@shared/domain/unityAssets';
import { changedAssetsOf, diffAssetsPoint, inWorkspaceRepository, pointForModel, lastChangeAssetsPoint, revisionsAssetsPoint, workspaceAssetsPoint } from './assetsPoints';

const revision = (revisionId: number, fileName = 'Art/Tree.fbx'): ContentSource => ({ kind: 'revision', revision: { revisionId, repository: 'eco@local' }, fileName });
const workspaceFile: ContentSource = { kind: 'workspaceFile', path: 'Art/Tree.fbx' };
const entry = (path: string, baseRevisionId: number, revisionId: number, extra: Partial<DiffEntry> = {}): DiffEntry => ({
  status: 'changed',
  path,
  itemType: 'binaryFile',
  baseRevisionId,
  revisionId,
  repository: 'eco@local',
  ...extra,
});

describe('workspaceAssetsPoint', () => {
  it("is the disk for a workspace file, and nothing for any other version: never the disk's files of another revision", () => {
    expect(workspaceAssetsPoint('modified', workspaceFile)).toEqual({ kind: 'workspace' });
    expect(workspaceAssetsPoint('original', { kind: 'workspaceBase', path: 'Art/Tree.fbx' })).toEqual({ kind: 'workspace' });
    expect(workspaceAssetsPoint('modified', revision(4))).toBeNull();
    expect(workspaceAssetsPoint('original', { kind: 'empty' })).toBeNull();
  });
});

describe('diffAssetsPoint', () => {
  const entries = [entry('Art/Tree.fbx', 3, 4), entry('Art/bark.png', 5, 6), entry('Art/new.png', -1, 7, { status: 'added' }), entry('Art', 1, 2, { itemType: 'directory' })];

  it("is the tree where a branch's diff points to, and before it that tree with the diff's changes undone", () => {
    const pointOf = diffAssetsPoint(entries, { kind: 'branch', branch: '/main/task' });
    expect(pointOf('modified', revision(4))).toEqual({ kind: 'repository', at: 'br:/main/task' });
    expect(pointOf('original', revision(3))).toEqual({
      kind: 'repository',
      at: 'br:/main/task',
      before: {
        kind: 'changes',
        changes: [
          { path: 'Art/Tree.fbx', revision: { revisionId: 3, repository: 'eco@local' } },
          { path: 'Art/bark.png', revision: { revisionId: 5, repository: 'eco@local' } },
          { path: 'Art/new.png', revision: null },
        ],
      },
    });
    expect(diffAssetsPoint(entries, { kind: 'changeset', changesetId: 12 })('modified', revision(4))).toEqual({ kind: 'repository', at: 'cs:12' });
  });

  it("has none in a shelve or at a label, whose trees can't be listed; a pending side is the disk", () => {
    expect(diffAssetsPoint(entries, { kind: 'shelve', shelveId: 3 })('modified', revision(4))).toBeNull();
    expect(diffAssetsPoint(entries, { kind: 'range', fromSpec: 'lb:v1', toSpec: 'lb:v2' })('original', revision(3))).toBeNull();
    expect(diffAssetsPoint(entries, { kind: 'branch', branch: '/main' })('modified', workspaceFile)).toEqual({ kind: 'workspace' });
  });
});

describe('changedAssetsOf', () => {
  it('undoes a move both ways: gone from where it went, there where it was', () => {
    expect(changedAssetsOf([entry('Art/New/bark.png', 5, 6, { status: 'moved', oldPath: 'Art/Old/bark.png' })])).toEqual([
      { path: 'Art/New/bark.png', revision: null },
      { path: 'Art/Old/bark.png', revision: { revisionId: 5, repository: 'eco@local' } },
    ]);
  });

  it("keeps an xlinked file's revision in its own repository, and gives up past what a request may carry", () => {
    expect(changedAssetsOf([entry('lib/leaf.png', 9, 10, { repository: 'shared@acme@cloud' })])).toEqual([{ path: 'lib/leaf.png', revision: { revisionId: 9, repository: 'shared@acme@cloud' } }]);
    expect(changedAssetsOf(Array.from({ length: MAX_CHANGED_ASSETS + 1 }, (_, i) => entry(`f${i}.png`, 1, 2)))).toBeNull();
  });
});

describe('pointForModel', () => {
  const change = (path: string) => ({ path, revision: null });
  const undoing = (...paths: string[]) => ({ kind: 'repository' as const, at: 'cs:3', before: { kind: 'changes' as const, changes: paths.map(change) } });

  it("keeps the changes under the model's Unity project, or under its folder outside one", () => {
    const point = undoing('Game/Assets/Art/bark.png', 'Game/Packages/manifest.json', 'Docs/readme.md', 'Gamer/x.png');
    expect(pointForModel(point, 'Game/Assets/Art/Tree/Tree.fbx')).toEqual(undoing('Game/Assets/Art/bark.png', 'Game/Packages/manifest.json'));
    expect(pointForModel(undoing('3DModels/izh-27/textures/a.png', '3DModels/other/b.png'), '3DModels/izh-27/scene.gltf')).toEqual(undoing('3DModels/izh-27/textures/a.png'));
    expect(pointForModel(undoing('a.png', 'Docs/b.png'), 'scene.gltf')).toEqual(undoing('a.png', 'Docs/b.png'));
  });

  it('leaves any other point as it is', () => {
    expect(pointForModel({ kind: 'workspace' }, 'Assets/Tree.fbx')).toEqual({ kind: 'workspace' });
    expect(pointForModel({ kind: 'repository', at: 'cs:3', before: { kind: 'changeset', changeset: 3, repository: 'eco@local' } }, 'Assets/Tree.fbx')).toEqual({ kind: 'repository', at: 'cs:3', before: { kind: 'changeset', changeset: 3, repository: 'eco@local' } });
  });
});

describe('revisionsAssetsPoint and lastChangeAssetsPoint', () => {
  it("puts a history's revisions each at the changeset that made it, only in the workspace's repository", () => {
    const points = { changesets: { original: 7, modified: 9 }, inWorkspaceRepository: true, lastPathChange: null };
    const pointOf = revisionsAssetsPoint(points);
    expect(pointOf('original', revision(3))).toEqual({ kind: 'repository', at: 'cs:7' });
    expect(pointOf('modified', revision(4))).toEqual({ kind: 'repository', at: 'cs:9' });
    expect(revisionsAssetsPoint({ ...points, inWorkspaceRepository: false })('modified', revision(4))).toBeNull();
    // Before the item last moved, its materials at its path now would be another file's.
    expect(revisionsAssetsPoint({ ...points, lastPathChange: 8 })('original', revision(3))).toBeNull();
  });

  it("puts Files' last change at its changeset, and before it, that changeset undone; a shelve's has none", () => {
    const pointOf = lastChangeAssetsPoint(12, 'eco@local', true);
    expect(pointOf('modified', revision(4))).toEqual({ kind: 'repository', at: 'cs:12' });
    expect(pointOf('original', revision(3))).toEqual({ kind: 'repository', at: 'cs:12', before: { kind: 'changeset', changeset: 12, repository: 'eco@local' } });
    expect(lastChangeAssetsPoint(null, 'eco@local', true)('modified', revision(4))).toBeNull();
  });

  it("gives no point while the workspace's repository isn't known: an xlinked revision would list the wrong tree", () => {
    expect(inWorkspaceRepository('eco@local', undefined)).toBeUndefined();
    expect(inWorkspaceRepository('eco@local', 'eco@local')).toBe(true);
    expect(inWorkspaceRepository('art@local', 'eco@local')).toBe(false);
    expect(revisionsAssetsPoint({ changesets: { original: 7, modified: 9 }, inWorkspaceRepository: undefined, lastPathChange: null })('modified', revision(4))).toBeNull();
    expect(lastChangeAssetsPoint(12, 'eco@local', undefined)('modified', revision(4))).toBeNull();
  });
});
