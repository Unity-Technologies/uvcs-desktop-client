import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { MAX_CHANGED_ASSETS } from '@shared/domain/unityAssets';
import { changedAssetsOf, diffAssetsPoint, lastChangeAssetsPoint, revisionsAssetsPoint, workspaceAssetsPoint } from './assetsPoints';

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

describe('revisionsAssetsPoint and lastChangeAssetsPoint', () => {
  it("puts a history's revisions each at the changeset that made it, only in the workspace's repository", () => {
    const pointOf = revisionsAssetsPoint({ original: 7, modified: 9 }, true);
    expect(pointOf('original', revision(3))).toEqual({ kind: 'repository', at: 'cs:7' });
    expect(pointOf('modified', revision(4))).toEqual({ kind: 'repository', at: 'cs:9' });
    expect(revisionsAssetsPoint({ original: 7, modified: 9 }, false)('modified', revision(4))).toBeNull();
  });

  it("puts Files' last change at its changeset, and before it, that changeset undone; a shelve's has none", () => {
    const pointOf = lastChangeAssetsPoint(12, true);
    expect(pointOf('modified', revision(4))).toEqual({ kind: 'repository', at: 'cs:12' });
    expect(pointOf('original', revision(3))).toEqual({ kind: 'repository', at: 'cs:12', before: { kind: 'changeset', changeset: 12 } });
    expect(lastChangeAssetsPoint(null, true)('modified', revision(4))).toBeNull();
  });
});
