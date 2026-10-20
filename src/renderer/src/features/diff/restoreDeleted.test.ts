import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import type { DeletedItemRestore } from '@shared/domain/explorer';
import { useNavigation } from '../../app/navigation/navigationStore';
import { answerConfirms, answerPrompts, askedDialogs } from '../../testing/fakeDialogs';
import { pressToastAction, shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { MAX_RESTORED_WITHOUT_ASKING, restoreDeletedItems, restoreDeletedItemTo } from './restoreDeleted';

const ws = '/ws';
const repository = 'game@local';
const enemy: DeletedItemRestore = { revision: { revisionId: 18, repository }, path: 'src/Enemy.cs' };
const docs: DeletedItemRestore = { revision: { revisionId: 24, repository }, path: 'docs' };

/** What main answers when every item came back. */
const restoredAll = { restored: 1, total: 1 };

const restoresAsked = () => fakeApi.argsOf('explorer.restoreDeleted').map((args) => args[1]);

describe('restoreDeletedItems', () => {
  it('brings the items back as pending changes, then leads to them', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => restoredAll);
    useNavigation.setState({ view: 'changesets', pages: [] });

    await restoreDeletedItems(ws, [enemy, docs]);

    expect(restoresAsked()).toEqual([[enemy, docs]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Restored 2 items', detail: 'Each where it was', action: 'View changes' }]);
    pressToastAction('Restored 2 items');
    expect(whereTheWindowIs().view).toBe('changes');
  });

  it('names the one item restored', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => restoredAll);

    await restoreDeletedItems(ws, [enemy]);

    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'success', title: 'Restored Enemy.cs', detail: 'At src/Enemy.cs' })]);
  });

  it('refreshes the workspace, not its locks nor the repository, which a restore leaves alone', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => restoredAll);
    const refreshed = watchRefreshes(ws);

    await restoreDeletedItems(ws, [enemy]);

    expect(refreshed()).toEqual(['explorer', 'info', 'pendingChanges', 'review']);
  });

  it('offers to restore an item elsewhere when its place is taken, starting from where it was', async () => {
    const message = 'src/Enemy.cs is already in the workspace. Restore it to another path.';
    fakeApi.answer('explorer.restoreDeleted', () => ({ restored: 0, total: 1, refused: { kind: 'placeTaken', path: 'src/Enemy.cs', message } }));

    await restoreDeletedItems(ws, [enemy]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Couldn’t restore Enemy.cs', detail: message, action: 'Restore to…' }]);
    answerPrompts(undefined);
    pressToastAction('Couldn’t restore Enemy.cs');
    expect(askedDialogs()).toEqual([expect.objectContaining({ kind: 'prompt', initialValue: 'src/Enemy.cs' })]);
  });

  it('offers to restore elsewhere the item whose folder is gone, of several', async () => {
    const message = 'docs isn’t in the workspace. Restore docs/a.md to another folder.';
    const guide = { ...enemy, path: 'docs/a.md' };
    fakeApi.answer('explorer.restoreDeleted', () => ({ restored: 0, total: 2, refused: { kind: 'folderMissing', path: 'docs/a.md', message } }));

    await restoreDeletedItems(ws, [enemy, guide]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Couldn’t restore 2 items', detail: message, action: 'Restore to…' }]);
    answerPrompts(undefined);
    pressToastAction('Couldn’t restore 2 items');
    expect(askedDialogs()).toEqual([expect.objectContaining({ kind: 'prompt', initialValue: 'docs/a.md' })]);
  });

  it('shows where the workspace already has an item, as another path would not help', async () => {
    const message = 'The workspace already has this item, at src/Old/Enemy.cs.';
    fakeApi.answer('explorer.restoreDeleted', () => ({ restored: 0, total: 1, refused: { kind: 'alreadyLoaded', path: 'src/Enemy.cs', loadedPath: 'src/Old/Enemy.cs', message } }));

    await restoreDeletedItems(ws, [enemy]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Couldn’t restore Enemy.cs', detail: message, action: 'Show in Files' }]);
    pressToastAction('Couldn’t restore Enemy.cs');
    expect(whereTheWindowIs().view).toBe('files');
  });

  it('offers nothing more for what can’t come back anywhere', async () => {
    const message = 'lib is or holds an xlink, and xlinks can’t be restored.';
    fakeApi.answer('explorer.restoreDeleted', () => ({ restored: 0, total: 1, refused: { kind: 'xlink', path: 'lib', message } }));

    await restoreDeletedItems(ws, [{ ...docs, path: 'lib' }]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Couldn’t restore lib', detail: message }]);
  });

  it('says what came back before a refusal', async () => {
    const message = 'The workspace already has this item, at docs.';
    fakeApi.answer('explorer.restoreDeleted', () => ({ restored: 2, total: 5, refused: { kind: 'alreadyLoaded', path: 'docs', loadedPath: 'docs', message } }));

    await restoreDeletedItems(ws, [enemy, docs, enemy, enemy, enemy]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Restored 2 of 5 items', detail: message, action: 'Show in Files' }]);
  });

  it('says what came back before it was stopped', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => ({ restored: 2, total: 5, stopped: true }));
    useNavigation.setState({ view: 'changesets', pages: [] });

    await restoreDeletedItems(ws, [enemy, docs, enemy, enemy, enemy]);

    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Restored 2 of 5 items', detail: 'Stopped before the rest', action: 'View changes' }]);
  });

  it('tells any other failure as cm told it', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => {
      throw new Error('Could not connect to the server.');
    });

    await restoreDeletedItems(ws, [enemy]);

    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'error', title: 'Restoring Enemy.cs failed', detail: 'Could not connect to the server.' })]);
  });

  it('asks first past a few items, as each comes back with a command of its own', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => restoredAll);
    const many = Array.from({ length: MAX_RESTORED_WITHOUT_ASKING + 1 }, (_, index) => ({ ...enemy, path: `src/File${index}.cs` }));
    answerConfirms(false);

    await restoreDeletedItems(ws, many);

    expect(askedDialogs()).toEqual([expect.objectContaining({ kind: 'confirm', title: `Restore ${many.length} items?` })]);
    expect(fakeApi.methods()).toEqual([]);
  });

  it('restores a few items without asking', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => restoredAll);
    const few = Array.from({ length: MAX_RESTORED_WITHOUT_ASKING }, (_, index) => ({ ...enemy, path: `src/File${index}.cs` }));

    await restoreDeletedItems(ws, few);

    expect(askedDialogs()).toEqual([]);
    expect(restoresAsked()).toEqual([few]);
  });
});

describe('restoreDeletedItemTo', () => {
  it('asks where, starting from where the item was, and restores it there', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => restoredAll);
    answerPrompts('src/old/Enemy.cs');

    await restoreDeletedItemTo(ws, enemy);

    expect(askedDialogs()).toEqual([expect.objectContaining({ kind: 'prompt', title: 'Restore Enemy.cs', initialValue: 'src/Enemy.cs' })]);
    expect(restoresAsked()).toEqual([[{ ...enemy, path: 'src/old/Enemy.cs' }]]);
  });

  it('takes a path in the workspace only', async () => {
    answerPrompts(undefined);

    await restoreDeletedItemTo(ws, enemy);

    const { validate } = askedDialogs()[0]!;
    expect(validate!('src/Enemy-old.cs')).toBeUndefined();
    expect(validate!('../Enemy.cs')).toBeDefined();
    expect(validate!('src//Enemy.cs')).toBeDefined();
    expect(validate!('/src/Enemy.cs')).toBeDefined();
  });

  it('restores nothing when cancelled', async () => {
    answerPrompts(undefined);

    await restoreDeletedItemTo(ws, docs);

    expect(fakeApi.methods()).toEqual([]);
  });
});
