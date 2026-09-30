import { beforeEach, describe, expect, it, vi } from 'vitest';

// The trash's name comes from the platform, read as the modules load.
vi.hoisted(() => Object.assign(globalThis, { window: { uvcs: { platform: 'darwin' } } }));

vi.mock('../../api/client', () => import('./filesTestDoubles').then(({ fakeApi }) => ({ api: fakeApi })));
vi.mock('../../app/operations/runOperation', () => import('./filesTestDoubles').then(({ fakeRunOperation, fakeRunAction }) => ({ runOperation: fakeRunOperation, runAction: fakeRunAction, runRead: fakeRunAction })));
vi.mock('../../ui/dialog/confirm', () => import('./filesTestDoubles').then(({ fakeConfirm }) => ({ confirm: fakeConfirm })));
vi.mock('../../ui/dialog/prompt', () => import('./filesTestDoubles').then(({ fakePrompt }) => ({ prompt: fakePrompt })));
vi.mock('../../ui/toast/toastStore', () => import('./filesTestDoubles').then(({ fakeToast }) => ({ toast: fakeToast })));
vi.mock('../../app/queryClient', async () => ({ queryClient: new (await import('@tanstack/react-query')).QueryClient() }));

import type { TreeItem } from '@shared/domain/explorer';
import { queryClient } from '../../app/queryClient';
import { useCutItemsStore } from './cutItemsStore';
import { directoryListingKey } from './fileOperations';
import { doubles, settled } from './filesTestDoubles';
import { useFilesViewStore } from './filesViewStore';
import { pasteCutItems, pastePlanFor } from './pasteItems';

const ws = '/ws';
const item = (path: string, changes: Partial<TreeItem> = {}): TreeItem =>
  ({ path, name: path.slice(path.lastIndexOf('/') + 1), itemType: 'file', isPrivate: false, ...changes }) as TreeItem;
const folder = (path: string, changes: Partial<TreeItem> = {}): TreeItem => item(path, { itemType: 'directory', ...changes });

/** The folders as the tree read them. */
function listed(listings: Record<string, TreeItem[]>): void {
  for (const [directory, items] of Object.entries(listings)) queryClient.setQueryData(directoryListingKey(ws, directory), items);
}

const cut = (...items: TreeItem[]) => useCutItemsStore.getState().cut(ws, items);
const cutPaths = () => useCutItemsStore.getState().items.map((cutItem) => cutItem.path);

beforeEach(() => {
  doubles.reset();
  queryClient.clear();
  useCutItemsStore.getState().clear();
  useFilesViewStore.setState({ revealRequest: null });
  doubles.answers['explorer.listDirectory'] = () => [];
});

describe('what Paste would do (menus and commands)', () => {
  it('has nothing to paste where the items were cut in another workspace', () => {
    useCutItemsStore.getState().cut('/other', [item('a.ts')]);
    expect(pastePlanFor(ws, [folder('docs')])).toEqual({ kind: 'refused', reason: 'Nothing is cut' });
  });

  it("tells a private folder by its parent's listing, and keeps controlled items out of it", () => {
    listed({ '': [folder('notes', { isPrivate: true }), folder('docs')] });
    cut(item('src/a.ts'));
    expect(pastePlanFor(ws, [folder('notes', { isPrivate: true })])).toEqual({ kind: 'refused', reason: '/notes is private: add it to version control first' });
    expect(pastePlanFor(ws, [folder('docs')])).toMatchObject({ kind: 'ready' });
  });

  it("finds clashes among the names of the folder's listing, in any case", () => {
    listed({ docs: [item('docs/README.md')] });
    cut(item('readme.md'), item('src/b.ts'));
    expect(pastePlanFor(ws, [item('docs/guide.md')])).toMatchObject({ kind: 'ready', target: 'docs', clashes: ['readme.md'] });
  });
});

describe('pasting the cut items', () => {
  it("moves them in one operation, reading the folder's names first if the tree never did, then selects them and forgets the cut", async () => {
    cut(item('src/a.ts'), item('b.txt', { isPrivate: true }));
    await pasteCutItems(ws, [folder('docs')]);
    expect(doubles.calls).toEqual([
      { method: 'explorer.listDirectory', args: [ws, 'docs'] },
      {
        method: 'explorer.moveItems',
        args: [
          ws,
          [
            { from: 'src/a.ts', to: 'docs/a.ts', isPrivate: false },
            { from: 'b.txt', to: 'docs/b.txt', isPrivate: true },
          ],
          'operation-1',
        ],
      },
    ]);
    expect(useFilesViewStore.getState().revealRequest).toEqual({ path: 'docs/a.ts', selected: ['docs/a.ts', 'docs/b.txt'] });
    expect(cutPaths()).toEqual([]);
    expect(doubles.toasts).toMatchObject([{ kind: 'success', title: 'Moved 2 items', detail: 'To /docs', action: { label: 'Undo' } }]);
  });

  it('moves them back with Undo', async () => {
    cut(item('src/a.ts'));
    await pasteCutItems(ws, [folder('docs')]);
    doubles.toasts[0]!.action!.run();
    await settled();
    expect(doubles.writes[1]).toEqual({ method: 'explorer.moveItems', args: [ws, [{ from: 'docs/a.ts', to: 'src/a.ts', isPrivate: false }], 'operation-1'] });
  });

  it('says why it can not paste, moving nothing', async () => {
    cut(folder('src'));
    await pasteCutItems(ws, [folder('src/lib')]);
    expect(doubles.writes).toEqual([]);
    expect(doubles.toasts).toEqual([{ kind: 'info', title: 'Can’t paste here', detail: 'Can’t move “src” into a folder inside it' }]);
    expect(cutPaths()).toEqual(['src']);
  });

  it('asks before leaving items whose names the folder has, and moves nothing when cancelled', async () => {
    doubles.answers['explorer.listDirectory'] = () => [item('docs/A.ts')];
    cut(item('src/a.ts'), item('src/b.ts'));
    doubles.dialogAnswers.push(false);
    await pasteCutItems(ws, [folder('docs')]);
    expect(doubles.dialogs).toMatchObject([{ kind: 'confirm', title: '“a.ts” is already in /docs' }]);
    expect(doubles.writes).toEqual([]);
    expect(cutPaths()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('moves only the others once the user agrees, replacing nothing', async () => {
    doubles.answers['explorer.listDirectory'] = () => [item('docs/A.ts')];
    cut(item('src/a.ts'), item('src/b.ts'));
    await pasteCutItems(ws, [folder('docs')]);
    expect(doubles.writes).toEqual([{ method: 'explorer.moveItems', args: [ws, [{ from: 'src/b.ts', to: 'docs/b.ts', isPrivate: false }], 'operation-1'] }]);
  });

  it('keeps the items cut when the move fails, to try again', async () => {
    doubles.answers['explorer.moveItems'] = () => {
      throw new Error('The item docs/a.ts already exists');
    };
    cut(item('src/a.ts'));
    await pasteCutItems(ws, [folder('docs')]);
    expect(cutPaths()).toEqual(['src/a.ts']);
    expect(useFilesViewStore.getState().revealRequest).toBeNull();
    expect(doubles.toasts).toMatchObject([{ kind: 'error', title: 'Moving items failed' }]);
  });
});
