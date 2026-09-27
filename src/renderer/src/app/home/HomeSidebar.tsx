import { House, Layers, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppMark } from '../../components/AppMark';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer } from '../../lib/servers';
import { NavFooter, NavGroup, NavGroups, NavItem, Sidebar } from '../../ui/nav/SidebarNav';
import { CenteredSpinner } from '../../ui/Spinner';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useSidebarCollapsed } from '../shell/sidebarStore';
import { SidebarToggleItem } from '../shell/SidebarToggleItem';
import { useServers } from '../workspace/workspaceQueries';
import { isSameSection, type HomeSection } from './homeSection';
import { ServerMonogram } from './ServerMonogram';
import styles from './Home.module.css';

interface HomeSidebarProps {
  section: HomeSection;
  onSelect: (section: HomeSection) => void;
}

export function HomeSidebar({ section, onSelect }: HomeSidebarProps) {
  const { data: servers, isLoading } = useServers();
  const rail = useSidebarCollapsed();

  const item = (target: HomeSection, icon: ReactNode, label: string, detail?: string) => (
    <NavItem key={label} icon={icon} label={label} detail={detail} active={isSameSection(section, target)} onClick={() => onSelect(target)} />
  );

  return (
    <Sidebar width={232} rail={rail}>
      <div className={styles.brand} data-rail={rail}>
        <AppMark size={28} />
        <span className={styles.brandName}>Unity Version Control</span>
      </div>

      <NavGroups>
        <NavGroup label="Workspaces">
          {item({ kind: 'welcome' }, <House size={15} />, 'Home')}
          {item({ kind: 'all' }, <Layers size={15} />, 'All workspaces')}
        </NavGroup>

        <NavGroup label="Repositories">
          {isLoading && <CenteredSpinner />}
          {servers?.map((profile) => {
            const { label, detail } = describeServer(profile.server);
            // Folded, every organization would be the same cloud: their initials tell them apart.
            const icon = rail && profile.server !== 'local' ? <ServerMonogram label={label} /> : <ServerIcon server={profile.server} />;
            return item({ kind: 'server', server: profile.server }, icon, label, detail);
          })}
        </NavGroup>
      </NavGroups>

      <NavFooter>
        <NavItem icon={<Settings size={15} />} label="Settings" onClick={openSettingsDialog} />
        <SidebarToggleItem />
      </NavFooter>
    </Sidebar>
  );
}
