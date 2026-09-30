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
import { isSameSection, type HomeSection } from './homeSection';
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
  const repositories = (servers ?? []).map((profile) => {
    const { label, detail } = describeServer(profile.server);
    // Folded, every organization would be the same cloud: their initials tell them apart.
    const icon = rail && profile.server !== 'local' ? <ServerMonogram label={label} /> : <ServerIcon server={profile.server} />;
    const railLabel = profile.server === 'local' ? 'Local' : undefined;
    return item({ kind: 'server', server: profile.server }, icon, label, { detail, railLabel });
  });

  return (
    <Sidebar width={232} rail={rail}>

      <NavGroups
        sections={[
          {
            label: 'Workspaces',
            items: [item({ kind: 'welcome' }, <House size={15} />, 'Home'), item({ kind: 'all' }, <Layers size={15} />, 'All workspaces', { railLabel: 'All' })],
          },
          { label: 'Repositories', items: isLoading ? [{ key: 'loading', element: <CenteredSpinner /> }] : repositories },
        ]}
      />

      <NavFooter>
        <NavItem icon={<Settings size={15} />} label="Settings" onClick={openSettingsDialog} />
        <SidebarToggleItem />
      </NavFooter>
    </Sidebar>
  );
}
