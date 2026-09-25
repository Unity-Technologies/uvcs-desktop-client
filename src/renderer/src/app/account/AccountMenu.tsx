import { ExternalLink, Keyboard, Settings, SunMoon, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Account } from '@shared/domain/account';
import { api } from '../../api/client';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer, isCloudServer } from '../../lib/servers';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Kbd } from '../../ui/Kbd';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { openShortcutsDialog } from '../commands/ShortcutsDialog';
import { openSettingsDialog, openSettingsDialogAt } from '../settings/SettingsDialog';
import { THEMES } from '../settings/themes';
import { useSettings, useUpdateSettings } from '../settings/useSettings';
import { useAccounts } from './accounts';
import { cloudDashboardUrl, organizationName, signInMethod } from './serverAccount';
import styles from './AccountMenu.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface AccountMenuProps {
  server: string;
  identity: { user: string; account?: Account };
  onDone: () => void;
}

/**
 * The account card: who you are and where, the cloud dashboard, every account `cm` knows, and the app-wide
 * preferences that belong to you rather than to the workspace (theme, settings, shortcuts).
 */
export function AccountMenu({ server, identity, onDone }: AccountMenuProps) {
  const { user, account } = identity;
  const { data: accounts } = useAccounts();
  const { theme } = useSettings();
  const updateSettings = useUpdateSettings();
  const cloud = isCloudServer(server);
  const place = organizationName(server, account) ?? describeServer(server).label;
  const kind = cloud ? 'Unity Cloud' : server === 'local' ? 'Local server' : 'Server';

  // Most items open a dialog: close first so focus goes where it should.
  const closeThen = (action: () => void) => () => {
    onDone();
    action();
  };

  return (
    <>
      <div className={styles.identity}>
        <Avatar user={user} size={40} tip={null} />
        <div className={styles.who}>
          <span className={styles.name}>{displayName(user)}</span>
          <span className={styles.user}>{user}</span>
        </div>
      </div>

      <div className={styles.server}>
        <span className={styles.serverIcon}>
          <ServerIcon server={server} size={14} />
        </span>
        <span className={styles.serverText}>
          <span className={styles.serverName}>{place}</span>
          <span className={styles.serverDetail}>
            {kind} · {account ? signInMethod(account.workingMode) : 'default user'}
          </span>
        </span>
        {cloud && (
          <button
            className={styles.dashboard}
            data-tip="Open the organization in the Unity Cloud dashboard"
            onClick={closeThen(() => void api.system.openExternal(cloudDashboardUrl(server, account)))}
          >
            Dashboard
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      <div className={styles.group}>
        <MenuRow icon={<Users size={14} />} onClick={closeThen(() => openSettingsDialogAt('accounts'))} trailing={accounts && <span className={styles.count}>{accounts.length}</span>}>
          Manage accounts…
        </MenuRow>
      </div>

      <div className={styles.group}>
        <div className={styles.themeRow}>
          <SunMoon size={14} />
          <span className={styles.rowLabel}>Theme</span>
          <SegmentedControl
            value={theme}
            onChange={(choice) => updateSettings({ theme: choice })}
            segments={THEMES.map(({ value, label, icon: ThemeIcon }) => ({ value, label: <ThemeIcon size={13} />, title: label }))}
          />
        </div>
        <MenuRow icon={<Settings size={14} />} onClick={closeThen(openSettingsDialog)} trailing={<Kbd keys={hotkey('settings')} />}>
          Settings…
        </MenuRow>
        <MenuRow icon={<Keyboard size={14} />} onClick={closeThen(openShortcutsDialog)} trailing={<Kbd keys={hotkey('shortcuts')} />}>
          Keyboard shortcuts
        </MenuRow>
      </div>
    </>
  );
}

function MenuRow({ icon, trailing, onClick, children }: { icon: ReactNode; trailing?: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button className={styles.row} onClick={onClick}>
      {icon}
      <span className={styles.rowLabel}>{children}</span>
      {trailing}
    </button>
  );
}
