import { Trash2 } from 'lucide-react';
import type { Account } from '@shared/domain/account';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer } from '../../lib/servers';
import { Avatar } from '../../ui/Avatar';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { removeAccount, useAccounts } from '../account/accounts';
import { accountForServer, organizationName, signInMethod } from '../account/serverAccount';
import { serverOfPlace } from '../workspace/placeOrigin';
import { useSession } from '../workspace/sessionStore';
import { useWorkspaceInfoOf } from '../workspace/useWorkspace';
import styles from './AccountsPane.module.css';

/**
 * The connection profiles `cm` signs in with, one per server, shared with the official client and the CLI.
 * Signing in stays with the official client: it runs the Unity ID / SSO flow this app doesn't.
 */
export function AccountsPane() {
  const { data: accounts, isLoading } = useAccounts();
  const place = useSession((state) => state.place);
  const { data: info } = useWorkspaceInfoOf(useSession((state) => state.workspacePath));
  const server = place ? serverOfPlace(place, info) : undefined;
  const inUse = server && accounts ? accountForServer(accounts, server) : undefined;
  // The account of the window's place comes first: "Manage accounts" in the account menu usually starts from it.
  const ordered = accounts && inUse ? [inUse, ...accounts.filter((account) => account !== inUse)] : accounts;

  return (
    <>
      <p className={styles.intro}>
        The accounts this computer signs in with, one per server. They are shared with the Unity Version Control app and the command line.
      </p>
      {isLoading && <CenteredSpinner />}
      {ordered && (
        <ul className={styles.list}>
          {ordered.map((account) => (
            <AccountRow key={account.name} account={account} inUse={account === inUse} />
          ))}
        </ul>
      )}
      <p className={styles.hint}>
        To add an account or sign in again, sign in to the server or organization with the Unity Version Control app, or run{' '}
        <code>cm profile create</code> in a terminal.
      </p>
    </>
  );
}

function AccountRow({ account, inUse }: { account: Account; inUse: boolean }) {
  const place = organizationName(account.server, account) ?? describeServer(account.server).label;

  return (
    <li className={styles.row}>
      <Avatar user={account.user} size={28} ownAccount />
      <div className={styles.text}>
        <span className={styles.server}>
          <ServerIcon server={account.server} size={13} />
          {place}
          {inUse && <span className={styles.inUse}>This workspace</span>}
        </span>
        <span className={styles.user}>
          {account.user} · {signInMethod(account.workingMode)}
        </span>
      </div>
      <IconButton icon={<Trash2 size={14} />} label={`Remove the account on ${place}`} onClick={() => void removeAccount(account)} />
    </li>
  );
}
