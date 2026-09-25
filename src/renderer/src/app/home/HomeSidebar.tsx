import { Clock, Cloud, HardDrive, Layers, Server, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
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
    <button key={label} className={styles.sidebarItem} data-active={isSameSection(section, target)} onClick={() => onSelect(target)}>
      {icon}
      <span className={styles.sidebarLabel}>{label}</span>
      {detail && <span className={styles.sidebarDetail}>{detail}</span>}
    </button>
  );

  return (
    <nav className={styles.sidebar}>
      <div className={styles.dragRegion} />
      <div className={styles.brand}>
        <span className={styles.logo}>◆</span>
        <span className={styles.brandName}>Unity Version Control</span>
      </div>

      <div className={styles.sidebarGroup}>
        <div className={styles.sidebarGroupLabel}>Workspaces</div>
        {item({ kind: 'recent' }, <Clock size={15} />, 'Recent')}
        {item({ kind: 'all' }, <Layers size={15} />, 'All workspaces')}
      </div>

      <div className={styles.sidebarGroup}>
        <div className={styles.sidebarGroupLabel}>Repositories</div>
        {isLoading && <CenteredSpinner />}
        {servers?.map((profile) => {
          const { label, detail } = describeServer(profile.server);
          return item({ kind: 'server', server: profile.server }, serverIcon(profile.server), label, detail);
        })}
      </div>

      <div className={styles.sidebarFooter}>
        <button className={styles.sidebarItem} onClick={openSettingsDialog}>
          <Settings size={15} />
          <span className={styles.sidebarLabel}>Settings</span>
        </button>
      </div>
    </nav>
  );
}

/** `acme@cloud` → organization "acme" on Unity Cloud; `local` → this computer. */
function describeServer(server: string): { label: string; detail?: string } {
  if (server === 'local') return { label: 'This computer' };
  const [organization, host] = server.split('@');
  if (host === 'cloud' || host === 'unity') return { label: organization ?? server, detail: 'Cloud' };
  return { label: server };
}

function serverIcon(server: string): ReactNode {
  if (server === 'local') return <HardDrive size={15} />;
  if (/@(cloud|unity)$/.test(server)) return <Cloud size={15} />;
  return <Server size={15} />;
}
