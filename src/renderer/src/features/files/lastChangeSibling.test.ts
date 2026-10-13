import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import type { TreeItem } from '@shared/domain/explorer';
import { lastChangeSibling } from './lastChangeSibling';

const item = (path: string, changes: Partial<TreeItem> = {}): TreeItem => ({
  path,
  name: path.split('/').pop()!,
  itemType: 'file',
  size: 10,
  date: '2026-10-13T13:08:00',
  isPrivate: false,
  isCheckedOut: false,
  changeset: 251,
  branch: '/main',
  owner: 'dani',
  revisionId: 90,
  parentRevisionId: 80,
  repository: 'game@local',
  itemId: 1,
  ...changes,
});

const model = item('Models/Car/scene.gltf', { revisionId: 11, parentRevisionId: 10 });
const listings = (...items: TreeItem[]): Map<string, TreeItem[]> => new Map([['Models/Car', [model, ...items]]]);
const side = (revisionId: number): ContentSource => ({ kind: 'revision', revision: { revisionId, repository: 'game@local' }, fileName: model.path });
const revisionOf = (revisionId: number, fileName = 'Models/Car/scene.bin', repository = 'game@local'): ContentSource => ({ kind: 'revision', revision: { revisionId, repository }, fileName });

describe('lastChangeSibling', () => {
  it('reads both versions of a sibling changed in the same changeset as the model', () => {
    const find = lastChangeSibling(model, listings(item('Models/Car/scene.bin', { revisionId: 21, parentRevisionId: 20 })));
    expect(find('modified', side(11), model.path, 'scene.bin')).toEqual(revisionOf(21));
    expect(find('original', side(10), model.path, 'scene.bin')).toEqual(revisionOf(20));
  });

  it('reads the one revision of a sibling the changeset left alone, on both sides', () => {
    const find = lastChangeSibling(model, listings(item('Models/Car/scene.bin', { changeset: 120, revisionId: 21, parentRevisionId: 20 })));
    expect(find('modified', side(11), model.path, 'scene.bin')).toEqual(revisionOf(21));
    expect(find('original', side(10), model.path, 'scene.bin')).toEqual(revisionOf(21));
  });

  it('finds no side before for a sibling added with the model', () => {
    const find = lastChangeSibling(model, listings(item('Models/Car/scene.bin', { revisionId: 21, parentRevisionId: -1 })));
    expect(find('original', side(10), model.path, 'scene.bin')).toBeNull();
  });

  it('finds none of a sibling changed after the model, which no longer goes with its revision', () => {
    const find = lastChangeSibling(model, listings(item('Models/Car/scene.bin', { changeset: 300 })));
    expect(find('modified', side(11), model.path, 'scene.bin')).toBeNull();
    expect(find('original', side(10), model.path, 'scene.bin')).toBeNull();
  });

  it('finds none in another repository than the model, across an xlink', () => {
    const find = lastChangeSibling(model, listings(item('Models/Car/scene.bin', { repository: 'art@local', changeset: 120 })));
    expect(find('modified', side(11), model.path, 'scene.bin')).toBeNull();
  });

  it('finds a sibling in a folder below the model, once that folder is listed', () => {
    const buffers = item('Models/Car/buffers/scene.bin', { revisionId: 21, parentRevisionId: 20 });
    const find = lastChangeSibling(model, new Map([['Models/Car', [model]], ['Models/Car/buffers', [buffers]]]));
    expect(find('modified', side(11), model.path, 'buffers/scene.bin')).toEqual(revisionOf(21, 'Models/Car/buffers/scene.bin'));
    expect(lastChangeSibling(model, listings())('modified', side(11), model.path, 'buffers/scene.bin')).toBeNull();
  });

  it('reads a sibling under an xlink in its own repository', () => {
    const linked = item('Models/Car/scene.gltf', { repository: 'art@local', revisionId: 11, parentRevisionId: 10 });
    const find = lastChangeSibling(linked, new Map([['Models/Car', [linked, item('Models/Car/scene.bin', { repository: 'art@local', revisionId: 21 })]]]));
    expect(find('modified', side(11), linked.path, 'scene.bin')).toEqual(revisionOf(21, 'Models/Car/scene.bin', 'art@local'));
  });

  it('finds none that is private, missing, or outside the model folder', () => {
    const find = lastChangeSibling(model, listings(item('Models/Car/scene.bin', { isPrivate: true })));
    expect(find('modified', side(11), model.path, 'scene.bin')).toBeNull();
    expect(find('modified', side(11), model.path, 'other.bin')).toBeNull();
    expect(find('modified', side(11), model.path, '../scene.bin')).toBeNull();
  });

  it('pairs revisions of a shelve by the shelve, which has no changeset', () => {
    const shelved = item('Models/Car/scene.gltf', { changeset: null, shelveId: 4, revisionId: 11, parentRevisionId: 10 });
    const bin = item('Models/Car/scene.bin', { changeset: null, shelveId: 4, revisionId: 21, parentRevisionId: 20 });
    const find = lastChangeSibling(shelved, new Map([['Models/Car', [shelved, bin]]]));
    expect(find('modified', side(11), shelved.path, 'scene.bin')).toEqual(revisionOf(21));
    expect(find('original', side(10), shelved.path, 'scene.bin')).toEqual(revisionOf(20));
  });

  it('reads the one revision of a sibling a shelve left alone, on both sides', () => {
    const shelved = item('Models/Car/scene.gltf', { changeset: null, shelveId: 4, revisionId: 11, parentRevisionId: 10 });
    const bin = item('Models/Car/scene.bin', { changeset: 120, revisionId: 21, parentRevisionId: 20 });
    const find = lastChangeSibling(shelved, new Map([['Models/Car', [shelved, bin]]]));
    expect(find('modified', side(11), shelved.path, 'scene.bin')).toEqual(revisionOf(21));
    expect(find('original', side(10), shelved.path, 'scene.bin')).toEqual(revisionOf(21));
  });

  it('finds a workspace file beside it on disk, as anywhere else', () => {
    const find = lastChangeSibling(model, listings());
    expect(find('modified', { kind: 'workspaceFile', path: model.path }, model.path, 'scene.bin')).toEqual({ kind: 'workspaceFile', path: 'Models/Car/scene.bin' });
  });
});
