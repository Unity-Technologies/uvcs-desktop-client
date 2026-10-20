import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

// The workspace menu's modules read the platform as they load.

import type { WorkspaceSummary } from '@shared/domain/workspace';
import { isSubmenu, type Action, type MenuEntry } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { missingWorkspaceMenu, workspaceMenu } from './homeMenus';

const game: WorkspaceSummary = { name: 'game', path: '/wk/game', guid: 'guid-game' };

const entry = (menu: MenuEntry[], id: string): Action | undefined =>
  menu.find((item): item is Action => typeof item === 'object' && !isSubmenu(item) && item.id === id);

describe('workspaceMenu', () => {
  it('opens the workspace here, or in a new window with the keys that do it from the row', () => {
    const open = vi.fn();
    const menu = workspaceMenu(game, open);

    entry(menu, 'openWorkspace')!.run();
    entry(menu, 'openInNewWindow')!.run();

    expect(open.mock.calls).toEqual([
      ['/wk/game', 'here'],
      ['/wk/game', 'newWindow'],
    ]);
    expect(entry(menu, 'openInNewWindow')!.shortcut).toBe(hotkey('workspaceInNewWindow'));
  });

  it("offers no new window for a workspace whose folder is gone: there's nothing to work on beside another", () => {
    expect(entry(missingWorkspaceMenu(game, vi.fn()), 'openInNewWindow')).toBeUndefined();
  });
});
