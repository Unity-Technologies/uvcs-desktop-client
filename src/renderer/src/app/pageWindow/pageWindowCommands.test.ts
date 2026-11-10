import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { hotkey, SHORTCUTS } from '../../lib/shortcutRegistry';
import { menuCommandTarget } from '../commands/useMenuCommands';
import { pageWindowCommands } from './usePageWindowCommands';

const commands = pageWindowCommands(workspacePlace('/work/game'));

describe("a page window's commands", () => {
  it('refresh its own page, from ⌘R and from the menu, rather than bringing the workspace window forward', () => {
    const refresh = commands.find((command) => command.id === SHORTCUTS.refresh.commandId);

    expect(refresh?.shortcut).toBe(hotkey('refresh'));
    expect(menuCommandTarget(SHORTCUTS.refresh.commandId, commands, true)).toBe('here');
  });

  it("send the workspace's other commands to its workspace window", () => {
    expect(menuCommandTarget('branch.switch', commands, true)).toBe('workspaceWindow');
  });
});
