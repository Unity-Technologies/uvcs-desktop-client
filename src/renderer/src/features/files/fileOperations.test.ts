import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));

import type { TreeItem } from '@shared/domain/explorer';
import { queryClient } from '../../app/queryClient';
import { answerConfirms, answerPrompts, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes } from '../../testing/operationOutcome';
import { directoryListingKey } from './directoryListing';
import { addItems, checkoutItems, createItem, deleteItems, renameItem, targetDirectoryFor } from './fileOperations';
import { useFilesViewStore } from './filesViewStore';

const ws = '/ws';
const item = (path: string, changes: Partial<TreeItem> = {}): TreeItem =>
  ({ path, name: path.slice(path.lastIndexOf('/') + 1), itemType: 'file', isPrivate: false, ...changes }) as TreeItem;
const folder = (path: string, changes: Partial<TreeItem> = {}): TreeItem => item(path, { itemType: 'directory', ...changes });

/** Main does every change it is asked. */
const WRITES = ['explorer.addRecursive', 'pendingChanges.add', 'pendingChanges.checkout', 'system.moveToTrash', 'pendingChanges.remove', 'explorer.move', 'explorer.renamePrivate', 'explorer.create'];

beforeEach(() => {
  for (const method of WRITES) fakeApi.answer(method, () => undefined);
  useFilesViewStore.setState({ revealRequest: null });
});

describe('adding private items', () => {
  it('adds folders with everything inside them, and files on their own', async () => {
    await addItems(ws, [folder('assets', { isPrivate: true }), item('a.ts', { isPrivate: true }), item('assets2/b.ts', { isPrivate: true })]);
    expect(fakeApi.calls()).toEqual([
      { method: 'explorer.addRecursive', args: [ws, ['assets']] },
      { method: 'pendingChanges.add', args: [ws, ['a.ts', 'assets2/b.ts']] },
    ]);
  });

  it('refreshes the workspace and its locks, as checking out does, not the repository', async () => {
    const afterAdd = watchRefreshes(ws);
    await addItems(ws, [item('a.ts', { isPrivate: true })]);
    expect(afterAdd()).toEqual(['explorer', 'info', 'locks', 'pendingChanges', 'review']);

    const afterCheckout = watchRefreshes(ws);
    await checkoutItems(ws, [item('a.ts')]);
    expect(afterCheckout()).toEqual(['explorer', 'info', 'locks', 'pendingChanges', 'review']);
  });
});

describe('deleting items', () => {
  it('moves private items to the trash and removes controlled ones from version control, each after asking', async () => {
    await deleteItems(ws, [item('notes.txt', { isPrivate: true }), item('src/a.ts'), folder('old')]);
    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Move notes.txt to the trash?', 'Delete 2 items?']);
    expect(fakeApi.calls()).toEqual([
      { method: 'system.moveToTrash', args: [['/ws/notes.txt']] },
      { method: 'pendingChanges.remove', args: [ws, ['src/a.ts', 'old']] },
    ]);
  });

  it('deletes nothing the user said no to', async () => {
    answerConfirms(false);
    await deleteItems(ws, [item('src/a.ts')]);
    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Delete a.ts?']);
    expect(fakeApi.calls()).toEqual([]);
  });

  it('asks once when every item is private', async () => {
    await deleteItems(ws, [item('a.log', { isPrivate: true }), item('b.log', { isPrivate: true })]);
    expect(askedDialogs().map((dialog) => dialog.title)).toEqual(['Move 2 files to the trash?']);
  });
});

describe('renaming an item', () => {
  it('moves a controlled item in version control, and selects it under its new name', async () => {
    answerPrompts('b.ts');
    await renameItem(ws, item('src/a.ts'));
    expect(fakeApi.calls()).toEqual([{ method: 'explorer.move', args: [ws, 'src/a.ts', 'src/b.ts'] }]);
    expect(useFilesViewStore.getState().revealRequest).toEqual({ path: 'src/b.ts', selected: undefined });
  });

  it('renames a private item on disk only, at the root too', async () => {
    answerPrompts('new.txt');
    await renameItem(ws, item('old.txt', { isPrivate: true }));
    expect(fakeApi.calls()).toEqual([{ method: 'explorer.renamePrivate', args: [ws, 'old.txt', 'new.txt'] }]);
  });

  it('does nothing when cancelled or given the same name', async () => {
    answerPrompts(undefined, 'a.ts');
    await renameItem(ws, item('src/a.ts'));
    await renameItem(ws, item('src/a.ts'));
    expect(fakeApi.calls()).toEqual([]);
  });

  it("refuses a name another item of the folder has, in any case, but takes the item's own in another case", async () => {
    queryClient.setQueryData(directoryListingKey(ws, 'src'), [item('src/a.ts'), item('src/Other.ts')]);
    await renameItem(ws, item('src/a.ts'));
    const validate = askedDialogs()[0]!.validate!;
    expect(validate('other.ts')).toBe('“Other.ts” already exists here');
    expect(validate('A.ts')).toBeUndefined();
    expect(validate('sub/a.ts')).toBe('A name can’t contain “/”');
  });

  it('says so when the rename fails, selecting nothing', async () => {
    fakeApi.answer('explorer.move', () => {
      throw new Error('The item is locked');
    });
    answerPrompts('b.ts');
    await renameItem(ws, item('a.ts'));
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't rename a.ts", detail: 'The item is locked' }]);
    expect(useFilesViewStore.getState().revealRequest).toBeNull();
  });
});

describe('creating an item', () => {
  it('creates it in the folder, or at the root, and selects it', async () => {
    answerPrompts('intro.md', 'Makefile');
    await createItem(ws, 'docs', 'file');
    await createItem(ws, '', 'file');
    expect(fakeApi.calls()).toEqual([
      { method: 'explorer.create', args: [ws, 'docs/intro.md', 'file'] },
      { method: 'explorer.create', args: [ws, 'Makefile', 'file'] },
    ]);
    expect(useFilesViewStore.getState().revealRequest?.path).toBe('Makefile');
  });

  it('takes a name with folders, created along with it, but none the folder has', async () => {
    queryClient.setQueryData(directoryListingKey(ws, ''), [folder('docs')]);
    await createItem(ws, '', 'directory');
    const validate = askedDialogs()[0]!.validate!;
    expect(validate('docs/guides')).toBeUndefined();
    expect(validate('DOCS')).toBe('“docs” already exists here');
  });

  it('goes into the selected folder, or the folder of the selected file', () => {
    expect(targetDirectoryFor(folder('src/lib'))).toBe('src/lib');
    expect(targetDirectoryFor(item('src/lib/a.ts'))).toBe('src/lib');
    expect(targetDirectoryFor(undefined)).toBe('');
  });
});
