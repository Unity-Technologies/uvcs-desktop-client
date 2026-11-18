import { House, Layers, Settings } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { ServerProfile } from '@shared/domain/repository';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer } from '../../lib/servers';
import { NavFooter, NavGroups, NavItem, Sidebar, type NavSectionItem } from '../../ui/nav/SidebarNav';
import { CenteredSpinner } from '../../ui/Spinner';
import { useCommands } from '../commands/commandStore';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useSidebarCollapsed } from '../shell/sidebarStore';
import { SidebarToggleItem } from '../shell/SidebarToggleItem';
import { AccountSwitcher } from './AccountSwitcher';
import { accountSwitchCommands } from './accountSwitcherMenu';
import { homeServersOf } from './homeAccount';
import { showHomeAccount } from './homeAccountStore';
import { isSameSection, WELCOME, type HomeSection } from './homeSection';
import { serverEntryDetail, serverGroups } from './serverGroups';
import { useHomeAccount } from './useHomeAccount';
import { ServerMonogram } from './ServerMonogram';

interface HomeSidebarProps {
  section: HomeSection;
  onSelect: (section: HomeSection) => void;
}

export function HomeSidebar({ section, onSelect }: HomeSidebarProps) {
  const { accounts, shown, reading } = useHomeAccount();
  const rail = useSidebarCollapsed();
  useCommands(useMemo(() => accountSwitchCommands(accounts, shown, (account) => showHomeAccount(account, accounts)), [accounts, shown]));

  // `railLabel`: the short name the folded sidebar's tile shows, where "All workspaces" and "This computer" would wrap.
  const item = (target: HomeSection, icon: ReactNode, label: string, words: { detail?: string; railLabel?: string } = {}): NavSectionItem => {
    const active = isSameSection(section, target);
    return {
      key: label,
      active,
      element: (
        <NavItem icon={icon} label={label} railLabel={words.railLabel} detail={words.detail} active={active} onClick={() => onSelect(target)} />
      ),
    };
  };
  const serverItem = (profile: ServerProfile): NavSectionItem => {
    const { server } = profile;
    const { label } = describeServer(server);
    // Folded, every organization would be the same icon: their initials tell them apart.
    const icon = rail && server !== 'local' ? <ServerMonogram label={label} /> : <ServerIcon server={server} />;
    const railLabel = server === 'local' ? 'Local' : undefined;
    return item({ kind: 'server', server }, icon, label, { railLabel, detail: serverEntryDetail(profile, rail) });
  };
  const serverSections = reading
    ? [{ label: 'Servers', items: [{ key: 'loading', element: <CenteredSpinner /> }] }]
    : serverGroups(homeServersOf(accounts, shown)).map((group) => ({ label: group.label, items: group.servers.map(serverItem) }));

  return (
    <Sidebar width={232} rail={rail}>
      {shown && <AccountSwitcher accounts={accounts} shown={shown} />}
      <NavGroups
        sections={[
          {
            label: 'Workspaces',
            items: [item(WELCOME, <House size={15} />, 'Home'), item({ kind: 'all' }, <Layers size={15} />, 'All workspaces', { railLabel: 'All' })],
          },
          ...serverSections,
        ]}
      />

      <NavFooter>
        <NavItem icon={<Settings size={15} />} label="Settings" onClick={openSettingsDialog} />
        <SidebarToggleItem />
      </NavFooter>
    </Sidebar>
  );
}
