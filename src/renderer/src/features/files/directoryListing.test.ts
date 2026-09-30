import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { readListedItem } from './directoryListing';

const ws = '/ws';
const item = (path: string): TreeItem => ({ path, name: path.slice(path.lastIndexOf('/') + 1), itemType: 'file', isPrivate: false }) as TreeItem;

describe("an item read from its folder's listing (Go to file's actions)", () => {
  it('lists the folder holding it', async () => {
    fakeApi.answer('explorer.listDirectory', () => [item('src/a.ts')]);
    expect(await readListedItem(ws, 'src/a.ts')).toEqual(item('src/a.ts'));
    expect(fakeApi.calls()).toEqual([{ method: 'explorer.listDirectory', args: [ws, 'src'] }]);
  });

  it('lists the root for an item at the root', async () => {
    fakeApi.answer('explorer.listDirectory', () => [item('Makefile')]);
    expect(await readListedItem(ws, 'Makefile')).toEqual(item('Makefile'));
    expect(fakeApi.calls()).toEqual([{ method: 'explorer.listDirectory', args: [ws, ''] }]);
  });
});
