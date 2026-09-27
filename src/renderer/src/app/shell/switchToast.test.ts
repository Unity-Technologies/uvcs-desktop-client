import { describe, expect, it } from 'vitest';
import { switchToast } from './switchToast';

describe('switchToast', () => {
  it('tells which private file was in the way and the name cm kept it under', () => {
    const ending = switchToast({ kind: 'switched', renamedPrivates: [{ path: 'src/a.txt', renamedTo: 'src/a.txt.private.0' }] }, '/main/t1');

    expect(ending).toMatchObject({ title: 'Switched to /main/t1', detail: "Your private file a.txt was in the way: it's kept as a.txt.private.0." });
  });

  it('adds it to what happened to the changes', () => {
    const renamedPrivates = ['a', 'b'].map((name) => ({ path: name, renamedTo: `${name}.private.0` }));
    const ending = switchToast({ kind: 'bringPending', shelveId: 7, conflictCount: 1, renamedPrivates }, '/main/t1');

    expect(ending.detail).toBe("They're safe in shelve 7. 2 private files were in the way: they're kept renamed, as name.private.0.");
  });

  it('says nothing more when nothing was in the way', () => {
    expect(switchToast({ kind: 'brought' }, '/main/t1').detail).toBeUndefined();
  });
});
