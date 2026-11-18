import { Users } from 'lucide-react';
import type { UserAccount } from '@shared/domain/account';
import { SEPARATOR, type Icon, type MenuEntry } from '../../lib/actions';
import type { Command } from '../commands/commandStore';
import { unityAccountsOf } from '../account/userAccounts';

/** What the switcher's menu does: show an account's organizations, or open Settings › Accounts. */
export interface AccountSwitcherActions {
  show: (account: UserAccount) => void;
  manage: () => void;
  /** The account's avatar, drawn where a menu entry draws its icon. */
  avatarOf: (user: string) => Icon;
}

/**
 * The home switcher's menu (docs/features/accounts.md "Home"): with two Unity accounts or more, each one, the shown
 * one checked, then "Manage accounts…"; with one, only "Manage accounts…", as the button already shows it.
 */
export function accountSwitcherMenu(accounts: readonly UserAccount[], shown: UserAccount | undefined, actions: AccountSwitcherActions): MenuEntry[] {
  const unity = unityAccountsOf(accounts);
  const choices: MenuEntry[] =
    unity.length < 2
      ? []
      : [
          ...unity.map((account) => ({ id: `account:${account.id}`, label: account.user, icon: actions.avatarOf(account.user), checked: account === shown, run: () => actions.show(account) })),
          SEPARATOR,
        ];
  return [...choices, { id: 'manageAccounts', label: 'Manage accounts…', icon: Users, run: actions.manage }];
}

/** The palette's way to the switcher: a command per Unity account, the shown one checked; none with fewer than two. */
export function accountSwitchCommands(accounts: readonly UserAccount[], shown: UserAccount | undefined, show: (account: UserAccount) => void): Command[] {
  const unity = unityAccountsOf(accounts);
  if (unity.length < 2) return [];
  return unity.map((account) => ({
    id: `home.switchAccount.${account.id}`,
    group: 'Account',
    label: `Switch account to ${account.user}`,
    icon: Users,
    keywords: ['organizations', 'user', 'email'],
    checked: account === shown,
    run: () => show(account),
  }));
}
