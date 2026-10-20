import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommandStore, type Command } from './commandStore';
import { menuCommandTarget, runMenuCommand } from './useMenuCommands';

const noDialog = { querySelector: () => null };
const behindDialog = { querySelector: () => ({}) as Element };

function registered(owner: string, ...commands: Partial<Command>[]): ReturnType<typeof vi.fn>[] {
  const runs = commands.map(() => vi.fn());
  useCommandStore.getState().register(
    owner,
    commands.map((command, index) => ({ id: `cmd${index}`, group: 'Test', label: 'Test', ...command, run: runs[index]! })),
  );
  return runs;
}

afterEach(() => useCommandStore.setState({ commandsByOwner: new Map() }));

describe('runMenuCommand', () => {
  it('runs the command a native menu item names, whichever component registered it', () => {
    registered('sidebar', { id: 'app.sidebar' });
    const [checkin] = registered('changes', { id: 'changes.checkin' });

    runMenuCommand('changes.checkin', noDialog);

    expect(checkin).toHaveBeenCalledOnce();
  });

  it('does nothing for a command that is disabled or not registered now', () => {
    const [checkin] = registered('changes', { id: 'changes.checkin', disabled: true });

    runMenuCommand('changes.checkin', noDialog);
    runMenuCommand('branches.create', noDialog);

    expect(checkin).not.toHaveBeenCalled();
  });

  it('does nothing behind a modal dialog', () => {
    const [checkin] = registered('changes', { id: 'changes.checkin' });

    runMenuCommand('changes.checkin', behindDialog);

    expect(checkin).not.toHaveBeenCalled();
  });

  it('forgets the commands of a component once it unregisters, and takes the latest ones it registered', () => {
    registered('changes', { id: 'changes.checkin' });
    const [latest] = registered('changes', { id: 'changes.checkin' });
    const [gone] = registered('branches', { id: 'branches.create' });
    useCommandStore.getState().unregister('branches');

    runMenuCommand('changes.checkin', noDialog);
    runMenuCommand('branches.create', noDialog);

    expect(latest).toHaveBeenCalledOnce();
    expect(gone).not.toHaveBeenCalled();
  });
});

const PAGE_WINDOW_COMMANDS = [{ id: 'goto.branches' }, { id: 'app.commandPalette' }];

describe('where a menu bar command runs', () => {
  it('runs in a workspace window whatever it is: one it lacks just does nothing', () => {
    expect(menuCommandTarget('branch.switch', [{ id: 'branch.switch' }], false)).toBe('here');
    expect(menuCommandTarget('branch.switch', [], false)).toBe('here');
  });

  it("goes from a page window to its workspace window when the page window doesn't have it (Switch branch)", () => {
    expect(menuCommandTarget('branch.switch', PAGE_WINDOW_COMMANDS, true)).toBe('workspaceWindow');
  });

  it("runs in a page window when it has it: a view's command, which sends itself on", () => {
    expect(menuCommandTarget('goto.branches', PAGE_WINDOW_COMMANDS, true)).toBe('here');
  });
});
