import { create } from 'zustand';
import type { UserAccount } from '@shared/domain/account';
import { saveSettings } from '../settings/useSettings';
import { homeServersOf, sectionAfterSwitch } from './homeAccount';
import { useHomeSection } from './homeSectionStore';

interface HomeAccountPick {
  /** The Unity account picked in this window's switcher since it came to the home screen (`UserAccount.id`). */
  picked: string | undefined;
  forget: () => void;
}

/** What this window's switcher picked; `HomeScreen` forgets it as the window leaves the home screen. */
export const useHomeAccountPick = create<HomeAccountPick>()((set) => ({
  picked: undefined,
  forget: () => set({ picked: undefined }),
}));

/**
 * Shows `account`'s organizations in this window's home sidebar and remembers it for the next home screen: it changes
 * nothing in `cm`. Repositories of the account left give way to the welcome (`sectionAfterSwitch`).
 */
export function showHomeAccount(account: UserAccount, accounts: readonly UserAccount[]): void {
  useHomeAccountPick.setState({ picked: account.id });
  const { section, show } = useHomeSection.getState();
  show(sectionAfterSwitch(section, homeServersOf(accounts, account)));
  void saveSettings({ homeAccount: account.id });
}
