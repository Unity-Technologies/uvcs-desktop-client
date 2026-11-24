import { House, Layers, Settings } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { ServerProfile } from '@shared/domain/repository';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer } from '../../lib/servers';
import { NavFooter, NavGroups, NavItem, Sidebar, type NavSection, type NavSectionItem } from '../../ui/nav/SidebarNav';
import { CenteredSpinner } from '../../ui/Spinner';
import { useCommands } from '../commands/commandStore';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useSettings } from '../settings/useSettings';
import { useSidebarCollapsed } from '../shell/sidebarStore';
import { SidebarToggleItem } from '../shell/SidebarToggleItem';
import { AccountSwitcher } from './AccountSwitcher';
import { accountSwitchCommands } from './accountSwitcherMenu';
import { homeServersOf } from './homeAccount';
import { showHomeAccount } from './homeAccountStore';
import { isSameSection, WELCOME, type HomeSection } from './homeSection';
import { OrganizationEntry } from './OrganizationEntry';
import { OrganizationFilter } from './OrganizationFilter';
import { canBeFavorite, serverEntryDetail, serverGroups, showsOrganizationFilter } from './serverGroups';
import { useHomeAccount } from './useHomeAccount';
import { ServerMonogram } from './ServerMonogram';

interface HomeSidebarProps {
  section: HomeSection;
  onSelect: (section: HomeSection) => void;
}

export function HomeSidebar({ section, onSelect }: HomeSidebarProps) {
  const { accounts, shown, reading } = useHomeAccount();
  const rail = useSidebarCollapsed();
  const { favoriteOrganizations } = useSettings();
  // The filter's text, for the account it was typed for: another account's organizations start unfiltered.
  const [typed, setTyped] = useState({ account: '', text: '' });
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
    const entry = item({ kind: 'server', server }, icon, label, { railLabel, detail: serverEntryDetail(profile, rail) });
    if (!canBeFavorite(server)) return entry;
    return { ...entry, element: <OrganizationEntry server={server}>{entry.element}</OrganizationEntry> };
  };
  const servers = homeServersOf(accounts, shown);
  // Folded, the rail shows no filter, so none applies.
  const filtering = !reading && !rail && showsOrganizationFilter(servers);
  const filter = filtering && typed.account === (shown?.id ?? '') ? typed.text : '';
  const groups = serverGroups(servers, { favorites: favoriteOrganizations, filter });
  const serverSections: NavSection[] = reading
    ? [{ label: 'Servers', items: [{ key: 'loading', element: <CenteredSpinner /> }] }]
    : groups.map((group) => ({ label: group.label, items: group.servers.map(serverItem) }));
  const filterSection: NavSection = {
    items: [
      {
        key: 'filter',
        element: (
          <OrganizationFilter value={filter} onChange={(text) => setTyped({ account: shown?.id ?? '', text })} noMatches={groups.length === 0} />
        ),
      },
    ],
  };

  return (
    <Sidebar width={232} rail={rail}>
      {shown && <AccountSwitcher accounts={accounts} shown={shown} />}
      <NavGroups
        sections={[
          {
            label: 'Workspaces',
            items: [item(WELCOME, <House size={15} />, 'Home'), item({ kind: 'all' }, <Layers size={15} />, 'All workspaces', { railLabel: 'All' })],
          },
          ...(filtering ? [filterSection] : []),
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
