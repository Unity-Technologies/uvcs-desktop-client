import { describe, expect, it } from 'vitest';
import { removedItemSpec } from './removedItemSpec';

function fileInfo(fields: Record<string, string>): string {
  return `<FileInfo>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join('')}</FileInfo>`;
}

function fileInfos(parent: Record<string, string>, item: Record<string, string>): string {
  return `<?xml version="1.0" encoding="utf-8"?><FileInfos>${fileInfo(parent)}${fileInfo(item)}</FileInfos>`;
}

const removed = { ServerPath: '/ignored', RevisionChangeset: '7', Status: 'deleted', RepSpec: '' };

describe('removedItemSpec', () => {
  it('points at the loaded changeset of an item at the workspace root', () => {
    const xml = fileInfos({ ServerPath: '/', RepSpec: 'game@local', IsXlink: 'false' }, removed);
    expect(removedItemSpec(xml, 'a.txt')).toBe('serverpath:/a.txt#cs:7@game@local');
  });

  it('keeps the folder path of a nested item', () => {
    const xml = fileInfos({ ServerPath: '/src/core', RepSpec: 'game@local', IsXlink: 'false' }, removed);
    expect(removedItemSpec(xml, 'a.ts')).toBe('serverpath:/src/core/a.ts#cs:7@game@local');
  });

  it('looks for a direct child of an xlink at the root of the xlinked repository', () => {
    const xml = fileInfos({ ServerPath: '/lib', RepSpec: 'lib@local', IsXlink: 'true' }, removed);
    expect(removedItemSpec(xml, 'inner.txt')).toBe('serverpath:/inner.txt#cs:7@lib@local');
  });

  it('uses the path in the xlinked repository for folders under an xlink', () => {
    const xml = fileInfos({ ServerPath: '/sub', RepSpec: 'lib@local', IsXlink: 'false', IsUnderXlink: 'true' }, removed);
    expect(removedItemSpec(xml, 'x.txt')).toBe('serverpath:/sub/x.txt#cs:7@lib@local');
  });
});
