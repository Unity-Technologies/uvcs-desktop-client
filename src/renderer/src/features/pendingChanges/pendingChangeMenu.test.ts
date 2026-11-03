import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countedArray } from '@shared/testing/countedReads';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { useNavigation } from '../../app/navigation/navigationStore';
import { itemCopySubmenu, pendingChangeMenu } from './pendingChangeMenu';
import { useMetaDiffRequests } from './changesMetaDiff';

const dialogs = vi.hoisted(() => ({ askedToUndo: [] as unknown[] }));
vi.mock('./UndoChangesDialog', () => ({
  askUndoChanges: async (changes: unknown) => {
    dialogs.askedToUndo.push(changes);
    return null;
  },
}));

describe('itemCopySubmenu', () => {
  // Right-clicking 50,000 selected changes joined every path twice, full and relative, before the menu showed. What
  // each entry copies is in menuGrammar.test.ts.
  it('reads the paths of a selection only when one of its entries copies them', () => {
    const { array: paths, reads } = countedArray(Array.from({ length: 1_000 }, (_, index) => `src/file${index}.ts`));
    expect(itemCopySubmenu('/ws', paths)).not.toBeNull();
    expect(reads()).toBe(0);
  });
});

describe('Search matches', () => {
  const change = (path: string, kinds: ChangeKind[]): PendingChange => ({ path, kinds, itemType: 'file', size: 0, lastModified: '' });
  const deleted = change('src/Player.cs', ['locallyDeleted']);
  const added = change('src/Hero.cs', ['private']);
  const listed = [deleted, added];
  const offers = (menu: MenuEntry[]) => menu.some((entry) => entry !== SEPARATOR && entry.id === 'searchMatches');

  it('is offered on one item deleted from disk, one private item, or one move the detection made', () => {
    const detected: PendingChange = { ...change('src/Gun.cs', ['locallyMoved']), oldPath: 'src/Weapon.cs' };
    expect(offers(pendingChangeMenu('/ws', [deleted], [], { listed }))).toBe(true);
    expect(offers(pendingChangeMenu('/ws', [added], [], { listed }))).toBe(true);
    expect(offers(pendingChangeMenu('/ws', [detected], [], { listed: [...listed, detected] }))).toBe(true);
  });

  it('is not offered on several items, on other changes, or where the list is not at hand (the palette)', () => {
    expect(offers(pendingChangeMenu('/ws', listed, [], { listed }))).toBe(false);
    expect(offers(pendingChangeMenu('/ws', [change('src/Map.cs', ['changed'])], [], { listed }))).toBe(false);
    expect(offers(pendingChangeMenu('/ws', [deleted], []))).toBe(false);
  });
});

describe('Unity .meta files', () => {
  const change = (path: string, kinds: ChangeKind[]): PendingChange => ({ path, kinds, itemType: 'file', size: 0, lastModified: '' });
  const asset = change('Assets/Player.png', ['changed']);
  const meta = change('Assets/Player.png.meta', ['changed']);
  const other = change('Assets/Enemy.png', ['changed']);
  const metaOf = (item: PendingChange) => (item === asset ? meta : undefined);
  const ids = (menu: MenuEntry[]) => menu.flatMap((entry) => (entry === SEPARATOR ? [] : [entry.id]));
  const entry = (menu: MenuEntry[], id: string): Action =>
    menu.find((candidate): candidate is Action => candidate !== SEPARATOR && 'run' in candidate && candidate.id === id)!;

  beforeEach(() => {
    dialogs.askedToUndo = [];
    useNavigation.setState({ pages: [] });
  });

  it("undoes the asset's .meta with it, counting the rows selected", async () => {
    const menu = pendingChangeMenu('/ws', [asset], [], { metaOf });
    expect(entry(menu, 'undo').label).toBe('Undo changes…');
    expect(entry(pendingChangeMenu('/ws', [asset, other], [], { metaOf }), 'undo').label).toBe('Undo 2 changes…');
    entry(menu, 'undo').run();
    await vi.waitUntil(() => dialogs.askedToUndo.length > 0);
    expect(dialogs.askedToUndo).toEqual([[asset, meta]]);
  });

  it("adds the asset's private .meta with it, counting the rows selected", () => {
    const privateAsset = change('Assets/New.png', ['private']);
    const privateMeta = change('Assets/New.png.meta', ['private']);
    const menu = pendingChangeMenu('/ws', [privateAsset], [], { metaOf: (item) => (item === privateAsset ? privateMeta : undefined) });
    expect(entry(menu, 'add').label).toBe('Add to version control');
  });

  it("checks out the asset's .meta with it", async () => {
    const checkedOut = new Promise<unknown[]>((resolve) => fakeApi.answer('pendingChanges.checkout', (...args: unknown[]) => resolve(args)));
    entry(pendingChangeMenu('/ws', [asset], [], { metaOf }), 'checkout').run();
    expect(await checkedOut).toEqual(['/ws', ['Assets/Player.png', 'Assets/Player.png.meta']]);
  });

  it("opens the .meta's diff, history and file for one asset that has one", () => {
    const menu = pendingChangeMenu('/ws', [asset], [], { metaOf });
    expect(ids(menu)).toEqual(expect.arrayContaining(['metaDiff', 'metaHistory', 'openMeta']));

    entry(menu, 'metaDiff').run();
    expect(useMetaDiffRequests.getState().request).toEqual({ workspacePath: '/ws', path: 'Assets/Player.png' });
    entry(menu, 'metaHistory').run();
    expect(useNavigation.getState().pages.at(-1)).toEqual({ kind: 'history', path: 'Assets/Player.png.meta' });
  });

  it('keeps viewing the asset itself in its own entries', () => {
    entry(pendingChangeMenu('/ws', [asset], [], { metaOf }), 'history').run();
    expect(useNavigation.getState().pages.at(-1)).toEqual({ kind: 'history', path: 'Assets/Player.png' });
  });

  it('offers no .meta entries without a .meta, or for several items', () => {
    const metaIds = ['metaDiff', 'metaHistory', 'openMeta'];
    const offered = (menu: MenuEntry[]) => ids(menu).filter((id) => id !== undefined && metaIds.includes(id));
    expect(offered(pendingChangeMenu('/ws', [other], [], { metaOf }))).toEqual([]);
    expect(offered(pendingChangeMenu('/ws', [asset, other], [], { metaOf }))).toEqual([]);
    expect(offered(pendingChangeMenu('/ws', [asset], []))).toEqual([]);
  });
});
