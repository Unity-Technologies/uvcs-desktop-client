import { ChevronsUpDown } from 'lucide-react';
import type { UserAccount } from '@shared/domain/account';
import { Avatar } from '../../ui/Avatar';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { useInRail } from '../../ui/nav/SidebarNav';
import { openSettingsDialogAt } from '../settings/SettingsDialog';
import { accountSwitcherMenu } from './accountSwitcherMenu';
import { showHomeAccount } from './homeAccountStore';
import styles from './AccountSwitcher.module.css';

interface AccountSwitcherProps {
  accounts: UserAccount[];
  /** The Unity account the sidebar lists the organizations of (`homeAccountOf`). */
  shown: UserAccount;
}

/**
 * The Unity account whose organizations the home sidebar lists, at its top, and the menu to show another's or manage
 * them (docs/features/accounts.md "Home"). Folded, only its avatar.
 */
export function AccountSwitcher({ accounts, shown }: AccountSwitcherProps) {
  const rail = useInRail();
  const menu = () =>
    accountSwitcherMenu(accounts, shown, {
      show: (account) => showHomeAccount(account, accounts),
      manage: () => openSettingsDialogAt('accounts'),
      avatarOf: (user) => (props) => <AccountAvatar user={user} {...props} />,
    });

  return (
    <ActionDropdownMenu entries={menu} align="start">
      <button type="button" className={styles.switcher} data-rail={rail} aria-label={`Account: ${shown.user}`} data-tip={rail ? shown.user : undefined}>
        <Avatar user={shown.user} size={22} tip={null} ownAccount />
        <span className={styles.user}>{shown.user}</span>
        <ChevronsUpDown size={14} className={styles.chevron} />
      </button>
    </ActionDropdownMenu>
  );
}

/** An account's avatar in a menu entry's icon place, a little larger than the size the menu draws icons at. */
function AccountAvatar({ user, size = 14 }: { user: string; size?: number }) {
  return <Avatar user={user} size={size + 2} tip={null} ownAccount />;
}
