import { ChevronRight, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { Account } from '@shared/domain/account';
import { ServerIcon } from '../../components/ServerIcon';
import { Avatar } from '../../ui/Avatar';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { removeAccount, useUserAccounts } from '../account/accounts';
import { useWindowServer } from '../workspace/useWorkspace';
import { accountRowsOf, type AccountRow } from './accountRows';
import styles from './AccountsPane.module.css';

/**
 * The accounts this computer signs in with, one row each (`accountRowsOf`), shared with the official client and the CLI.
 * A Unity account opens to its organizations, each removed apart, as `cm` keeps one profile per server. Signing in
 * stays with the official client: it runs the Unity ID / SSO flow this app doesn't.
 */
export function AccountsPane() {
  const { data: accounts, isPending } = useUserAccounts();
  const placeServer = useWindowServer();
  const rows = accounts ? accountRowsOf(accounts, placeServer) : [];

  return (
    <>
      <p className={styles.intro}>
        The accounts this computer signs in with. They are shared with the Unity Version Control app and the command line.
      </p>
      {isPending && <CenteredSpinner />}
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <AccountRowItem key={row.account.id} row={row} />
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

function AccountRowItem({ row }: { row: AccountRow }) {
  const [expanded, setExpanded] = useState(false);
  const serversId = useId();
  const { account, detail, inUse, servers, expands } = row;
  const only = servers[0];

  return (
    <li className={styles.account}>
      <div className={styles.row}>
        {expands ? (
          <button type="button" className={styles.expand} aria-expanded={expanded} aria-controls={serversId} aria-label={`Organizations of ${account.user}`} onClick={() => setExpanded(!expanded)}>
            <ChevronRight size={14} className={styles.chevron} />
          </button>
        ) : (
          <span className={styles.expand} />
        )}
        <Avatar user={account.user} size={28} ownAccount />
        <div className={styles.text}>
          <span className={styles.user}>
            {account.user}
            {inUse && <span className={styles.inUse}>This workspace</span>}
          </span>
          <span className={styles.detail}>{detail}</span>
        </div>
        {!expands && only && <RemoveButton profile={only.profile} label={only.label} />}
      </div>
      {expands && expanded && (
        <ul id={serversId} className={styles.servers}>
          {servers.map(({ profile, label }) => (
            <li key={profile.name} className={styles.serverRow}>
              <ServerIcon server={profile.server} size={13} />
              <span className={styles.serverName}>{label}</span>
              <RemoveButton profile={profile} label={label} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RemoveButton({ profile, label }: { profile: Account; label: string }) {
  return <IconButton icon={<Trash2 size={14} />} label={`Remove the account on ${label}`} onClick={() => void removeAccount(profile)} />;
}
