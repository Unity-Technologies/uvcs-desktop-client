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

const restoresAsked = () => fakeApi.argsOf('explorer.restoreDeleted').map((args) => args[1]);

describe('restoreDeletedItems', () => {
  it('brings the items back as pending changes, then leads to them', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => undefined);
    useNavigation.setState({ view: 'changesets', pages: [] });

    await restoreDeletedItems(ws, [enemy, docs]);

    expect(restoresAsked()).toEqual([[enemy, docs]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Restored 2 items', detail: 'Each where it was', action: 'View changes' }]);
    pressToastAction('Restored 2 items');
    expect(whereTheWindowIs().view).toBe('changes');
  });

  it('names the one item restored', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => undefined);

    await restoreDeletedItems(ws, [enemy]);

    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'success', title: 'Restored Enemy.cs', detail: 'At src/Enemy.cs' })]);
  });

  it('refreshes the workspace, not its locks nor the repository, which a restore leaves alone', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => undefined);
    const refreshed = watchRefreshes(ws);

    await restoreDeletedItems(ws, [enemy]);

    expect(refreshed()).toEqual(['explorer', 'info', 'pendingChanges', 'review']);
  });

  it('says why when an item can’t come back, and offers to restore it elsewhere, starting from where it was', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => {
      throw new Error('src/Enemy.cs is already in the workspace. Restore it to another path.');
    });

    await restoreDeletedItems(ws, [enemy]);

    expect(shownToasts()).toEqual([
      { kind: 'error', title: 'Couldn’t restore Enemy.cs', detail: 'src/Enemy.cs is already in the workspace. Restore it to another path.', action: 'Restore to…' },
    ]);
    answerPrompts(undefined);
    pressToastAction('Couldn’t restore Enemy.cs');
    await Promise.resolve();
    expect(askedDialogs()).toEqual([expect.objectContaining({ kind: 'prompt', initialValue: 'src/Enemy.cs' })]);
  });

  it('says why several items can’t come back, with nothing to restore elsewhere for all of them', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => {
      throw new Error('docs is already in the workspace. Restore it to another path.');
    });

    await restoreDeletedItems(ws, [enemy, docs]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Couldn’t restore 2 items', detail: 'docs is already in the workspace. Restore it to another path.' }]);
  });

  it('asks first past a few items, as each comes back with a command of its own', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => undefined);
    const many = Array.from({ length: MAX_RESTORED_WITHOUT_ASKING + 1 }, (_, index) => ({ ...enemy, path: `src/File${index}.cs` }));
    answerConfirms(false);

    await restoreDeletedItems(ws, many);

    expect(askedDialogs()).toEqual([expect.objectContaining({ kind: 'confirm', title: `Restore ${many.length} items?` })]);
    expect(fakeApi.methods()).toEqual([]);
  });

  it('restores a few items without asking', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => undefined);
    const few = Array.from({ length: MAX_RESTORED_WITHOUT_ASKING }, (_, index) => ({ ...enemy, path: `src/File${index}.cs` }));

    await restoreDeletedItems(ws, few);

    expect(askedDialogs()).toEqual([]);
    expect(restoresAsked()).toEqual([few]);
  });
});

describe('restoreDeletedItemTo', () => {
  it('asks where, starting from where the item was, and restores it there', async () => {
    fakeApi.answer('explorer.restoreDeleted', () => undefined);
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
    expect(validate!('src\\Enemy.cs')).toBeDefined();
    expect(validate!('/src/Enemy.cs')).toBe('A path in the workspace starts with a folder or a name, not “/”');
  });

  it('restores nothing when cancelled', async () => {
    answerPrompts(undefined);

    await restoreDeletedItemTo(ws, docs);

    expect(fakeApi.methods()).toEqual([]);
  });
});
