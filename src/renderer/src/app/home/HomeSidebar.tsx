import { House, Layers, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer } from '../../lib/servers';
import { NavFooter, NavGroups, NavItem, Sidebar, type NavSectionItem } from '../../ui/nav/SidebarNav';
import { CenteredSpinner } from '../../ui/Spinner';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useSidebarCollapsed } from '../shell/sidebarStore';
import { SidebarToggleItem } from '../shell/SidebarToggleItem';
import { useServers } from '../workspace/workspaceQueries';
import { isSameSection, WELCOME, type HomeSection } from './homeSection';
import { serverGroups } from './serverGroups';
import { ServerMonogram } from './ServerMonogram';

interface HomeSidebarProps {
  section: HomeSection;
  onSelect: (section: HomeSection) => void;
}

export function HomeSidebar({ section, onSelect }: HomeSidebarProps) {
  const { data: servers, isLoading } = useServers();
  const rail = useSidebarCollapsed();

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
  const serverItem = (server: string): NavSectionItem => {
    // The group names the kind of organization, so its entries need no detail of their own; folded, where groups are
    // only rules, the tooltip says it (`navItemTip`): `acme · Unity organization` and `acme · Cloud organization`.
    const { label, detail } = describeServer(server);
    // Folded, every organization would be the same icon: their initials tell them apart.
    const icon = rail && server !== 'local' ? <ServerMonogram label={label} /> : <ServerIcon server={server} />;
    const railLabel = server === 'local' ? 'Local' : undefined;
    return item({ kind: 'server', server }, icon, label, { railLabel, detail: rail ? detail : undefined });
  };
  const serverSections = isLoading
    ? [{ label: 'Servers', items: [{ key: 'loading', element: <CenteredSpinner /> }] }]
    : serverGroups(servers ?? []).map((group) => ({ label: group.label, items: group.servers.map((profile) => serverItem(profile.server)) }));

  return (
    <Sidebar width={232} rail={rail}>

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
