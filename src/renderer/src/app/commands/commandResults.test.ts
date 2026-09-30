import { describe, expect, it } from 'vitest';
import { commandResult, paletteCommands } from './commandResults';
import type { Command } from './commandStore';

const command = (overrides: Partial<Command> = {}): Command => ({ id: 'app.settings', group: 'App', label: 'Settings', run: () => {}, ...overrides });

describe('paletteCommands', () => {
  it('offers every enabled command of every owner, but the one opening the palette', () => {
    const byOwner = new Map([
      ['app', [command(), command({ id: 'app.commandPalette', label: 'Show command palette' })]],
      ['changes', [command({ id: 'changes.checkin', group: 'Changes', label: 'Check in' }), command({ id: 'changes.undo', disabled: true })]],
    ]);

    expect(paletteCommands(byOwner).map((each) => each.id)).toEqual(['app.settings', 'changes.checkin']);
  });
});

describe('commandResult', () => {
  it('shows the group after the label, so commands of the same name in different groups read apart', () => {
    expect(commandResult(command({ label: 'Refresh', group: 'Workspace' }))).toMatchObject({ id: 'command:app.settings', label: 'Refresh', detail: 'Workspace' });
  });

  it('is found by a keyword, marking only the letters of the label shown', () => {
    const result = commandResult(command({ label: 'Keyboard shortcuts', keywords: ['hotkeys'] }), 'hotkeys');

    expect(result.quality).toBeGreaterThan(0);
    expect(result.labelMatches).toEqual([]);
  });

  it('marks the letters typed in the label and ranks nothing without a search', () => {
    expect(commandResult(command({ label: 'Settings' }), 'set').labelMatches).toEqual([0, 1, 2]);
    expect(commandResult(command()).quality).toBeUndefined();
  });
});
