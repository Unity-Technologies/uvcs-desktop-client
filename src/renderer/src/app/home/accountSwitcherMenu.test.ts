import { Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { serverAccount, unityAccount } from '../../testing/userAccounts';
import { accountSwitchCommands, accountSwitcherMenu } from './accountSwitcherMenu';

const ana = unityAccount('ana@example.com', ['acme@unity']);
const bo = unityAccount('bo@example.com', ['games@unity']);
const build = serverAccount('build:8087');

const actions = () => ({ show: vi.fn(), manage: vi.fn(), avatarOf: () => Users });
const words = (entries: MenuEntry[]) => entries.map((entry) => (entry === SEPARATOR ? '—' : `${(entry as Action).label}${(entry as Action).checked ? ' ✓' : ''}`));

describe('accountSwitcherMenu', () => {
  it('lists every Unity account, the shown one checked, then Manage accounts…', () => {
    expect(words(accountSwitcherMenu([ana, bo, build], bo, actions()))).toEqual(['ana@example.com', 'bo@example.com ✓', '—', 'Manage accounts…']);
  });

  it('holds only Manage accounts… with one Unity account, or none', () => {
    expect(words(accountSwitcherMenu([ana, build], ana, actions()))).toEqual(['Manage accounts…']);
    expect(words(accountSwitcherMenu([build], undefined, actions()))).toEqual(['Manage accounts…']);
  });

  it('shows the account picked, and opens the accounts to manage them', () => {
    const act = actions();
    const [anaEntry, , , manage] = accountSwitcherMenu([ana, bo], bo, act) as Action[];

    anaEntry!.run();
    manage!.run();

    expect(act.show).toHaveBeenCalledWith(ana);
    expect(act.manage).toHaveBeenCalledOnce();
  });
});

describe('accountSwitchCommands', () => {
  it('offers to switch to each Unity account, the shown one checked', () => {
    const show = vi.fn();
    const commands = accountSwitchCommands([ana, bo, build], ana, show);

    expect(commands.map((command) => [command.label, command.checked])).toEqual([
      ['Switch account to ana@example.com', true],
      ['Switch account to bo@example.com', false],
    ]);
    commands[1]!.run();
    expect(show).toHaveBeenCalledWith(bo);
  });

  it('offers nothing with fewer than two Unity accounts', () => {
    expect(accountSwitchCommands([ana, build], ana, vi.fn())).toEqual([]);
  });
});
