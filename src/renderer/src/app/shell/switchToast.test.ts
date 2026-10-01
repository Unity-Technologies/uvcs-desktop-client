import { describe, expect, it } from 'vitest';
import { switchToast } from './switchToast';

const words = (toast: ReturnType<typeof switchToast>) => ({ kind: toast.kind, title: toast.title, detail: toast.detail, action: toast.action?.label });

describe('switchToast', () => {
  it('says where the workspace went, leaving the line below to what was written when nothing else happened', () => {
    expect(words(switchToast({ kind: 'switched' }, '/main/task'))).toEqual({ kind: 'success', title: 'Switched to /main/task', detail: undefined, action: undefined });
  });

  it('tells where left changes stayed below the title, which stays short', () => {
    expect(words(switchToast({ kind: 'left', count: 1, sourceName: '/main', shelveId: 2 }, '/main/task'))).toEqual({
      kind: 'success',
      title: 'Switched to /main/task',
      detail: 'Your change stayed on main, in shelve 2.',
      action: undefined,
    });
    expect(switchToast({ kind: 'left', count: 3, sourceName: '/main', shelveId: 2, restored: { count: 1 } }, '/main/task').detail).toBe(
      'Your 3 changes stayed on main, in shelve 2. Restored the 1 change you left here.',
    );
  });

  it('offers the changes restored or brought along', () => {
    expect(words(switchToast({ kind: 'switched', restored: { count: 2 } }, '/main/task'))).toEqual({
      kind: 'success',
      title: 'Switched to /main/task',
      detail: 'Restored the 2 changes you left here.',
      action: 'View',
    });
    expect(words(switchToast({ kind: 'brought' }, '/main/task'))).toEqual({ kind: 'success', title: 'Switched to /main/task', detail: 'Your changes came along.', action: 'View' });
  });

  it('leads to the merge when the changes brought along wait for decisions', () => {
    expect(words(switchToast({ kind: 'bringPending', conflictCount: 2, shelveId: 5 }, '/main/task'))).toEqual({
      kind: 'info',
      title: 'Switched to /main/task',
      detail: '2 files need your decision to bring your changes. They’re safe in shelve 5.',
      action: 'Resolve now',
    });
    expect(switchToast({ kind: 'bringPending', conflictCount: 0, shelveId: 5 }, '/main/task').detail).toBe('Your changes weren’t applied yet. They’re safe in shelve 5.');
  });

  it('counts the unchanged checkouts it undid', () => {
    expect(switchToast({ kind: 'undidUnchangedCheckouts', count: 1 }, '/main/task').detail).toBe('Undid 1 unchanged checkout.');
  });

  it('tells which private file was in the way and the name cm kept it under', () => {
    const ending = switchToast({ kind: 'switched', renamedPrivates: [{ path: 'src/a.txt', renamedTo: 'src/a.txt.private.0' }] }, '/main/t1');

    expect(ending).toMatchObject({ title: 'Switched to /main/t1', detail: 'Your private file a.txt was in the way: it’s kept as a.txt.private.0.' });
  });

  it('adds the private files in the way to what happened to the changes', () => {
    const renamedPrivates = ['a', 'b'].map((name) => ({ path: name, renamedTo: `${name}.private.0` }));
    const ending = switchToast({ kind: 'bringPending', shelveId: 7, conflictCount: 1, renamedPrivates }, '/main/t1');

    expect(ending.detail).toBe('1 file needs your decision to bring your changes. They’re safe in shelve 7. 2 private files were in the way: they’re kept renamed, as name.private.0.');
  });
});
