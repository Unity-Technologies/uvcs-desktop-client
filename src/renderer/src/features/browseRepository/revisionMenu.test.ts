import { beforeEach, describe, expect, it, vi } from 'vitest';

// The menus' modules read the platform as they load.
vi.hoisted(() => {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const uvcs = { platform: 'darwin', invoke: async () => ({ ok: true }), on: () => () => {} };
  const window = Object.assign(new EventTarget(), { uvcs, localStorage: storage, matchMedia: () => ({ matches: false, addEventListener: () => {} }) });
  Object.assign(globalThis, { window, localStorage: storage, document: Object.assign(new EventTarget(), { visibilityState: 'visible' }) });
});

import type { TreeItem } from '@shared/domain/explorer';
import { navigation } from '../../app/navigation/navigationStore';
import type { Page } from '../../app/navigation/pages';
import { isSubmenu, type Action, type MenuEntry } from '../../lib/actions';
import { revisionMenu } from './revisionMenu';

const item = (path: string, changes: Partial<TreeItem> = {}): TreeItem =>
  ({ path, name: path.slice(path.lastIndexOf('/') + 1), itemType: 'file', isPrivate: false, revisionId: 40, repository: 'game@local', ...changes }) as TreeItem;

const actions = (menu: MenuEntry[]): Action[] =>
  menu.flatMap((entry) => (entry === 'separator' ? [] : isSubmenu(entry) ? entry.entries : [entry])).filter((entry): entry is Action => typeof entry === 'object' && 'run' in entry);
const entry = (menu: MenuEntry[], id: string): Action | undefined => actions(menu).find((action) => action.id === id);

const opened: Page[] = [];
beforeEach(() => {
  opened.length = 0;
  vi.spyOn(navigation, 'openPage').mockImplementation((page) => void opened.push(page));
});

describe("an item's menu while browsing a repository at a changeset", () => {
  it('copies the spec of the item at that changeset, by its path', () => {
    expect(entry(revisionMenu('/ws', 12, 'game@local', [item('src/a.ts')]), 'copy.spec')?.detail).toBe('serverpath:/src/a.ts#cs:12');
  });

  it('copies the spec of an item under an xlink by its revision, as no path at that changeset reaches it', () => {
    const xlinked = item('lib/b.cs', { repository: 'thirdparty@local', revisionId: 7 });
    expect(entry(revisionMenu('/ws', 12, 'game@local', [xlinked]), 'copy.spec')?.detail).toBe('revid:7@thirdparty@local');
  });

  it('opens the history of the revision shown', () => {
    entry(revisionMenu('/ws', 12, 'game@local', [item('src/a.ts')]), 'history')!.run();
    expect(opened).toEqual([{ kind: 'history', path: 'src/a.ts', revision: { revisionId: 40, repository: 'game@local' } }]);
  });

  it('offers only what applies to several items or a folder', () => {
    const several = revisionMenu('/ws', 12, 'game@local', [item('a.ts'), item('b.ts')]);
    expect(actions(several).map((action) => action.id)).toEqual(['copy.serverPath']);
    const folder = revisionMenu('/ws', 12, 'game@local', [item('src', { itemType: 'directory' })]);
    expect(entry(folder, 'openRevision')).toBeUndefined();
    expect(entry(folder, 'history')).toBeDefined();
  });
});
