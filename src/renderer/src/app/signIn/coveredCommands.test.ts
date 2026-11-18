import { describe, expect, it } from 'vitest';
import { commandsWhileCovered } from './coveredCommands';

const commands = [{ id: 'app.home' }, { id: 'app.settings' }, { id: 'app.newWindow' }, { id: 'goto.changes' }, { id: 'changes.checkin' }, { id: 'view.refresh' }];

describe('commandsWhileCovered', () => {
  it("keeps only the app's own commands while the sign-in screen covers the place: Home, Settings, a new window", () => {
    expect(commandsWhileCovered(commands, true).map((command) => command.id)).toEqual(['app.home', 'app.settings', 'app.newWindow']);
  });

  it('keeps every command while nothing covers the place', () => {
    expect(commandsWhileCovered(commands, false)).toEqual(commands);
  });
});
