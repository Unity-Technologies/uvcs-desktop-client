import { describe, expect, it } from 'vitest';
import { detailsKindOf, editableXlinkOf, iconTypeOf, isUnderXlink, newXlinkDirectoryOf, unloadedXlinkOf, xlinkDetailOf } from './xlinkItem';

const xlink = { writable: true, path: '/', changeset: 27649, repository: 'pnunit', server: 'codice@cloud' };

describe('An xlink in Files', () => {
  it('draws as an xlink, though it lists as a directory', () => {
    expect(iconTypeOf({ itemType: 'directory', xlink })).toBe('xlink');
    expect(iconTypeOf({ itemType: 'directory' })).toBe('directory');
    expect(iconTypeOf({ itemType: 'binaryFile' })).toBe('binaryFile');
  });

  it('is headed as a diff names it; other items by what they are', () => {
    expect(detailsKindOf({ itemType: 'directory', xlink })).toEqual({ icon: 'xlink', noun: 'Writable xlink' });
    expect(detailsKindOf({ itemType: 'directory' })).toEqual({ icon: 'directory', noun: 'Folder' });
    expect(detailsKindOf({ itemType: 'symlink' })).toEqual({ icon: 'symlink', noun: 'Link' });
    expect(detailsKindOf({ itemType: 'binaryFile' })).toEqual({ icon: 'file', noun: 'File' });
  });

  it("says where it points from the listing, else as cm fileinfo words it", () => {
    expect(xlinkDetailOf({ xlink }, { xlinkTarget: 'other words' })).toBe('Writable xlink to pnunit@codice@cloud at cs:27649');
    expect(xlinkDetailOf({}, { xlinkTarget: 'wxlink:/@12@lib@local' })).toBe('wxlink:/@12@lib@local');
    expect(xlinkDetailOf({}, undefined)).toBeUndefined();
  });
});

describe('Creating and editing xlinks from Files', () => {
  const inWorkspace = { underXlink: false, workspaceRepository: 'game@local' };
  const item = (path: string, itemType: 'file' | 'directory', changes: { isPrivate?: boolean; repository?: string; xlink?: typeof xlink } = {}) => ({
    path,
    itemType,
    isPrivate: false,
    repository: 'game@local',
    ...changes,
  });

  it('creates a new xlink in the folder selected, or the folder of the file selected, the root too', () => {
    expect(newXlinkDirectoryOf(item('code', 'directory'), inWorkspace)).toBe('code');
    expect(newXlinkDirectoryOf(item('code/a.cs', 'file'), inWorkspace)).toBe('code');
    expect(newXlinkDirectoryOf(item('', 'directory'), inWorkspace)).toBe('');
  });

  it('creates none from a private item: cm takes an xlink only in a controlled folder', () => {
    expect(newXlinkDirectoryOf(item('build', 'directory', { isPrivate: true }), inWorkspace)).toBeNull();
    expect(newXlinkDirectoryOf(item('code/notes.txt', 'file', { isPrivate: true }), inWorkspace)).toBeNull();
  });

  it('creates none from an xlink or anything under one: it would go in the xlinked repository', () => {
    expect(newXlinkDirectoryOf(item('code/lib', 'directory', { xlink }), inWorkspace)).toBeNull();
    expect(newXlinkDirectoryOf(item('code/lib/src', 'directory'), { ...inWorkspace, underXlink: true })).toBeNull();
    expect(newXlinkDirectoryOf(item('code/lib/src', 'directory', { repository: 'pnunit@codice@cloud' }), inWorkspace)).toBeNull();
  });

  it('trusts the listings alone until the workspace’s repository is read', () => {
    expect(newXlinkDirectoryOf(item('code/lib/src', 'directory', { repository: 'pnunit@codice@cloud' }), { underXlink: false, workspaceRepository: undefined })).toBe('code/lib/src');
  });

  it('edits an xlink of the workspace, not a folder, nor one nested in another xlink', () => {
    expect(editableXlinkOf({ isPrivate: false, xlink }, inWorkspace)).toEqual({ isPrivate: false, xlink });
    expect(editableXlinkOf({ isPrivate: false }, inWorkspace)).toBeNull();
    expect(editableXlinkOf({ isPrivate: false, xlink }, { underXlink: true })).toBeNull();
  });

  it('loads the files of a checked-in xlink whose folder is listed empty, and of no other', () => {
    const item = { isPrivate: false, xlink };
    expect(unloadedXlinkOf(item, inWorkspace, { added: false, listedItems: [] })).toEqual(item);
    expect(unloadedXlinkOf(item, inWorkspace, { added: false, listedItems: [{ path: 'code/lib/src' }] })).toBeNull();
    // Not read yet: nothing tells it is empty.
    expect(unloadedXlinkOf(item, inWorkspace, { added: false, listedItems: undefined })).toBeNull();
    // Not checked in: no command can load it yet.
    expect(unloadedXlinkOf(item, inWorkspace, { added: true, listedItems: [] })).toBeNull();
    expect(unloadedXlinkOf({ isPrivate: false }, inWorkspace, { added: false, listedItems: [] })).toBeNull();
    expect(unloadedXlinkOf(item, { underXlink: true }, { added: false, listedItems: [] })).toBeNull();
  });

  it('tells an item under an xlink from the folders listed above it', () => {
    const listings = new Map([
      ['', [{ path: 'code' }]],
      ['code', [{ path: 'code/lib', xlink }, { path: 'code/a.cs' }]],
      ['code/lib', [{ path: 'code/lib/src' }]],
    ]);
    const listing = (directory: string) => listings.get(directory);

    expect(isUnderXlink('code/lib/src/b.cs', listing)).toBe(true);
    expect(isUnderXlink('code/lib/src', listing)).toBe(true);
    expect(isUnderXlink('code/lib', listing)).toBe(false);
    expect(isUnderXlink('code/a.cs', listing)).toBe(false);
    expect(isUnderXlink('docs/unlisted.md', listing)).toBe(false);
  });
});
