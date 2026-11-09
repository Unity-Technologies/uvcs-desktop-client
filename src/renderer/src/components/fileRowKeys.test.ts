import { describe, expect, it } from 'vitest';
import type { ItemType } from '@shared/domain/pendingChanges';
import { fileRowKeys } from './fileRowKeys';

const row = (key: string, itemType: ItemType) => ({ type: 'file', key, item: { itemType } });

describe('fileRowKeys', () => {
  it('keeps every file row a diff steps on to, as the list shows them: text, binary, xlink, symlink', () => {
    const rows = [row('a.cs', 'file'), row('logo.png', 'binaryFile'), row('lib', 'xlink'), row('link', 'symlink')];
    expect(fileRowKeys(rows)).toEqual(['a.cs', 'logo.png', 'lib', 'link']);
  });

  it('never a folder, nor a group header, which show no diff', () => {
    const rows = [{ type: 'group', key: 'group:changed' }, row('Assets', 'directory'), row('Assets/a.cs', 'file')];
    expect(fileRowKeys(rows)).toEqual(['Assets/a.cs']);
  });
});
