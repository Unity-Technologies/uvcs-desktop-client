import { Clock, GitBranch, Layers, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { ServerIcon } from '../../components/ServerIcon';
import { describeServer } from '../../lib/servers';
import { NavFooter, NavGroup, NavGroups, NavItem, Sidebar } from '../../ui/nav/SidebarNav';
import { CenteredSpinner } from '../../ui/Spinner';
import { openSettingsDialog } from '../settings/SettingsDialog';
import { useServers } from '../workspace/workspaceQueries';
import { isSameSection, type HomeSection } from './homeSection';
import styles from './Home.module.css';

interface HomeSidebarProps {
  section: HomeSection;
  onSelect: (section: HomeSection) => void;
}

export function HomeSidebar({ section, onSelect }: HomeSidebarProps) {
  const { data: servers, isLoading } = useServers();

  const item = (target: HomeSection, icon: ReactNode, label: string, detail?: string) => (
    <NavItem key={label} icon={icon} label={label} detail={detail} active={isSameSection(section, target)} onClick={() => onSelect(target)} />
  );

  return (
    <Sidebar width={232}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <GitBranch size={15} />
        </span>
        <span className={styles.brandName}>Unity Version Control</span>
      </div>

      <NavGroups>
        <NavGroup label="Workspaces">
          {item({ kind: 'recent' }, <Clock size={15} />, 'Recent')}
          {item({ kind: 'all' }, <Layers size={15} />, 'All workspaces')}
        </NavGroup>

        <NavGroup label="Repositories">
          {isLoading && <CenteredSpinner />}
          {servers?.map((profile) => {
            const { label, detail } = describeServer(profile.server);
            return item({ kind: 'server', server: profile.server }, <ServerIcon server={profile.server} />, label, detail);
          })}
        </NavGroup>
      </NavGroups>

      <NavFooter>
        <NavItem icon={<Settings size={15} />} label="Settings" onClick={openSettingsDialog} />
      </NavFooter>
    </Sidebar>
  );
}
